const express = require("express");
const multer = require("multer");
const ffmpeg = require("fluent-ffmpeg");
const path = require("path");
require('bootstrap')

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

function getEvenlySpacedFrameTimes(duration, numFrames) {
  const interval = duration / (numFrames + 1);
  const frameTimes = [];

  for (let i = 1; i <= numFrames; i++) {
    const frameTime = i * interval;
    frameTimes.push(frameTime);
  }

  return frameTimes;
}

function extractFrames(videoPath, frameTimes) {
  return new Promise((resolve, reject) => {
    const frameUrls = [];
    let completedFrames = 0;

    frameTimes.forEach((frameTime, index) => {
      const outputPath = `frames/output_${index}.png`;

      ffmpeg(videoPath)
        .seekInput(frameTime)
        .frames(1)
        .output(outputPath)
        .on("end", () => {
          frameUrls.push(`/frames/output_${index}.png`);
          completedFrames++;

          if (completedFrames === frameTimes.length) {
            resolve(frameUrls);
          }
        })
        .on("error", (err) => {
          console.error("Error extracting frame:", err);
          reject(err);
        })
        .run();
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
    const duration = await getVideoDurationInSeconds(videoPath);
    const numFrames = 20; // Number of frames to extract
    const frameTimes = getEvenlySpacedFrameTimes(duration, numFrames);

    ffmpeg.setFfmpegPath("/opt/homebrew/bin/ffmpeg"); // Update the path to FFmpeg executable
    ffmpeg.setFfprobePath("/opt/homebrew/bin/ffprobe"); // Update the path to ffprobe executable

    const frameUrls = await extractFrames(videoPath, frameTimes);
    const sortedFrameUrls = sortFrameUrls(frameUrls);

    res.json({ frameUrls: sortedFrameUrls });
  } catch (err) {
    console.error("Error extracting frames:", err);
    res.status(500).json({ error: "An error occurred while extracting the frames." });
  }
});

function sortFrameUrls(frameUrls) {
  return frameUrls.sort((a, b) => {
    const frameNumberA = extractFrameNumber(a);
    const frameNumberB = extractFrameNumber(b);
    return frameNumberA - frameNumberB;
  });
}

function extractFrameNumber(frameUrl) {
  const regex = /output_(\d+)\.png/;
  const match = frameUrl.match(regex);
  if (match && match.length === 2) {
    return parseInt(match[1], 10);
  }
  return -1; // Return -1 if the frame number extraction fails
}

const port = 3000;
app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
