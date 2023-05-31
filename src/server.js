const express = require("express");
const multer = require("multer");
const ffmpeg = require("fluent-ffmpeg");
const path = require("path");

const app = express();
const upload = multer({ dest: "uploads/" });

function getVideoDurationInSeconds(videoPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        reject(err);
      } else {
        const duration = metadata.format.duration;
        resolve(duration);
      }
    });
  });
}

app.use(express.static(path.join(__dirname, "public")));
app.use("/frames", express.static(path.join(__dirname, "frames")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.post("/extract-frame", upload.single("video"), async (req, res) => {
  try {
    const videoPath = req.file.path;
    const outputPath = "frames/output.png";
    const duration = await getVideoDurationInSeconds(videoPath);
    const middleTime = duration * 0.5; // Extract frame at 50% of the video duration

    ffmpeg.setFfmpegPath("/opt/homebrew/bin/ffmpeg"); // Update the path to FFmpeg executable
    ffmpeg.setFfprobePath("//opt/homebrew/bin/ffprobe"); // Update the path to ffprobe executable

    ffmpeg(videoPath)
      .seekInput(middleTime)
      .frames(1) // Extract a single frame
      .output(outputPath)
      .on("start", (commandLine) => {
        console.log("FFmpeg command:", commandLine);
      })
      .on("progress", (progress) => {
        console.log("FFmpeg progress:", progress);
      })
      .on("end", () => {
        res.json({ frameUrl: `/frames/output.png` });
      })
      .on("error", (err) => {
        console.error("Error extracting frame:", err);
        res.status(500).json({ error: "An error occurred while extracting the frame." });
      })
      .run();
  } catch (err) {
    console.error("Error getting video duration:", err);
    res.status(500).json({ error: "An error occurred while getting the video duration." });
  }
});

const port = 3000;
app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
