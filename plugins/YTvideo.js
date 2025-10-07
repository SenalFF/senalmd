const { cmd } = require("../command");
const yts = require("yt-search");
const axios = require("axios");

const formats = ["144", "240", "360", "480", "720", "1080"];

// Module-level flag to ensure event listener is registered only once
let listenerRegistered = false;

// Helper function to print memory usage
const printMemoryUsage = (label) => {
  const usage = process.memoryUsage();
  const heapMB = (usage.heapUsed / 1024 / 1024).toFixed(2);
  const rssMB = (usage.rss / 1024 / 1024).toFixed(2);
  console.log(`🧠 Memory Usage [${label}]: Heap=${heapMB}MB, RSS=${rssMB}MB`);
};

cmd({
  pattern: "video",
  desc: "📹 Download YouTube Video via Senal YT DL (Supports up to 2GB streaming)",
  category: "download",
  react: "📹",
  filename: __filename
}, async (conn, mek, m, { from, args, q, reply }) => {  // Updated params to match TTDL (mek, m)
  if (!q) return reply("❗Please provide a YouTube link or video name.");

  try {
    // Search YouTube
    const search = await yts(q);
    const data = search.videos[0];
    if (!data?.videoId) return reply("❌ No results found.");

    const caption = `
📹 *${data.title}*
👤 *Developer:* Mr Senal
🔗 *Source:* YouTube
⏱ *Duration:* ${data.timestamp}
ℹ️ *Note:* High-res videos (720p+) may be large (up to 2GB) and take 10-30+ min to upload.
    `.trim();

    // Buttons for available formats (video only)
    const buttons = formats.map(f => ({
      buttonId: `dl_${data.videoId}_${f}`,
      buttonText: { displayText: `${f}p` },
      type: 1
    }));

    buttons.push({ buttonId: "api_info_vid", buttonText: { displayText: "ℹ️ API Info" }, type: 1 });

    await conn.sendMessage(from, {
      image: { url: data.thumbnail },
      caption,
      footer: "🚀 Powered by Senal YT DL",
      buttons,
      headerType: 4
    }, { quoted: mek });  // Use mek for quoted, matching TTDL

  } catch (err) {
    console.error("❌ YT Video command error:", {
      message: err.message,
      stack: err.stack,
      query: q ? q.substring(0, 50) : 'N/A'  // Truncate for log
    });
    reply("❌ An error occurred while processing your video. Check bot logs for details.");
  }

  // Register the global event listener only once (on first command execution)
  if (!listenerRegistered) {
    listenerRegistered = true;
    console.log("📡 Registering YT Video button event listener...");
    printMemoryUsage("Listener Registration");

    conn.ev.on("messages.upsert", async (messageUpdate) => {
      const mek = messageUpdate.messages[0];  // Use mek here too
      if (!mek?.message?.buttonsResponseMessage || mek.key.fromMe) return;

      const btnId = mek.message.buttonsResponseMessage.selectedButtonId;
      if (!btnId) return;

      const remoteJid = mek.key.remoteJid;

      try {
        if (btnId.startsWith("dl_")) {
          const [, videoId, format] = btnId.split("_");

          printMemoryUsage(`Button Click: ${format}p for ${videoId.substring(0, 10)}...`);

          const apiUrl = `https://senalytdl.vercel.app/download?id=${videoId}&format=${format}`;

          let res;
          try {
            reply("⏳ Downloading your video, please wait...");  // Add TTDL-style wait message
            const apiRes = await axios.get(apiUrl, { timeout: 30000 });
            res = apiRes.data;
          } catch (apiErr) {
            console.error("❌ API Fetch Error:", {
              message: apiErr.message,
              code: apiErr.code,
              response: apiErr.response?.status,
              url: apiUrl,
              videoId,
              format
            });
            return conn.sendMessage(remoteJid, { 
              text: `❌ Failed to fetch download URL from API. Error: ${apiErr.message}. Try again or check video availability.` 
            }, { quoted: mek });
          }

          if (!res.downloadUrl) {
            console.error("❌ No download URL in API response:", { response: res, videoId, format });
            return conn.sendMessage(remoteJid, { 
              text: "❌ Download URL not available from API. Video may be restricted." 
            }, { quoted: mek });
          }

          // Check file size via HEAD request (streams headers only, no full download)
          let fileSize = 0;
          let sizeGB = 0;
          let estimatedTime = "Unknown";
          try {
            printMemoryUsage("Before HEAD Request");
            const headRes = await axios.head(res.downloadUrl, { timeout: 10000 });
            fileSize = parseInt(headRes.headers['content-length'] || '0');
            sizeGB = (fileSize / (1024 ** 3)).toFixed(2);
            // Rough estimate: Assume 10 MB/s effective upload speed (adjust based on your server)
            const estimatedSeconds = fileSize / (10 * 1024 * 1024);
            estimatedTime = `${Math.round(estimatedSeconds / 60)}-${Math.round(estimatedSeconds / 60 + 10)} min`;
            printMemoryUsage("After HEAD Request");
          } catch (headErr) {
            console.error("⚠️ HEAD Request Error (size check failed):", {
              message: headErr.message,
              code: headErr.code,
              downloadUrl: res.downloadUrl.substring(0, 50) + '...',
              videoId,
              format
            });
            sizeGB = "Unknown";
            estimatedTime = "5-30+ min (large file)";
          }

          // Block >2GB, warn >500MB
          if (fileSize > 2 * 1024 ** 3) {
            console.error("❌ File Size Block (>2GB):", { sizeGB, fileSize, videoId, format });
            return conn.sendMessage(remoteJid, { 
              text: `❌ File too large (${sizeGB} GB) for WhatsApp (max 2GB). Try lower quality like 480p.` 
            }, { quoted: mek });
          }
          if (fileSize > 500 * 1024 ** 2) {
            await conn.sendMessage(remoteJid, { 
              text: `⚠️ Large file detected (${sizeGB} GB). Streaming upload will take ~${estimatedTime}. Please wait patiently.` 
            }, { quoted: mek });
          }

          // Fallback to search for title if API doesn't provide it
          let title = res.title;
          if (!title) {
            try {
              const search = await yts(`https://www.youtube.com/watch?v=${videoId}`);
              const data = search.videos[0];
              title = data?.title || "Unknown Title";
            } catch (titleErr) {
              console.error("⚠️ Title Fetch Error:", {
                message: titleErr.message,
                videoId
              });
              title = "Unknown Title";
            }
          }

          // Send "uploading" indicator for large files (TTDL-style wait)
          let uploadingMsg;
          if (fileSize > 100 * 1024 ** 2) {  // >100MB
            uploadingMsg = await conn.sendMessage(remoteJid, { 
              text: `⏳ Streaming ${sizeGB} GB file to WhatsApp... Estimated time: ${estimatedTime}. Do not resend.` 
            }, { quoted: mek });
          }

          // Retry function for upload (up to 3 attempts, with increased timeout for large files)
          // Simplified send to match TTDL structure: Prioritize document for large files, optional video preview
          const sendWithRetry = async (attempt = 1) => {
            let videoSent = false;
            let documentSent = false;

            try {
              printMemoryUsage(`Upload Start (Attempt ${attempt})`);

              // Optional: Send playable video preview ONLY if file <100MB (to avoid WhatsApp compression issues for large files)
              if (fileSize < 100 * 1024 ** 2) {
                try {
                  await conn.sendMessage(remoteJid, { 
                    video: { url: res.downloadUrl }, 
                    mimetype: "video/mp4",
                    caption: `📹 Video Preview ${format}p by *Mr Senal*`,
                    contextInfo: { mentionedJid: [mek.sender] }  // Match TTDL mention
                  }, { 
                    quoted: mek,
                    timeoutMs: 120000  // 2 min timeout for preview
                  });
                  videoSent = true;
                  printMemoryUsage("After Video Preview Send");
                  console.log(`✅ Video preview sent successfully (Attempt ${attempt})`);
                } catch (videoErr) {
                  console.error("❌ Video Preview Send Error:", {
                    message: videoErr.message,
                    code: videoErr.code || 'N/A',
                    stack: videoErr.stack,
                    attempt,
                    sizeGB,
                    downloadUrl: res.downloadUrl.substring(0, 50) + '...'
                  });
                  // Don't fail if preview fails
                  await conn.sendMessage(remoteJid, { 
                    text: `⚠️ Video preview failed (file too large for playback). Full file coming...` 
                  }, { quoted: mek });
                }
              } else {
                console.log(`⏭️ Skipping video preview for large file (${sizeGB} GB)`);
              }

              // Always send full document (streams up to 2GB, no compression) - Core like TTDL but as document
              const caption = `📹 *Mr Senal YT Video Downloader*\n\n` +
                              `👤 *Title:* ${title}\n` +
                              `🎥 *Quality:* ${format}p\n` +
                              `💾 *Size:* ${sizeGB} GB\n` +
                              `🔗 *Source:* YouTube\n\n` +
                              `✅ Full video streamed by *Mr Senal*`;  // TTDL-style formatted caption

              try {
                await conn.sendMessage(remoteJid, { 
                  document: { url: res.downloadUrl }, 
                  mimetype: "video/mp4", 
                  fileName: `${title.replace(/[^a-zA-Z0-9]/g, '_')}_${format}.mp4`,  // Sanitize filename
                  caption: caption,
                  contextInfo: { mentionedJid: [mek.sender] }  // Match TTDL mention
                }, { 
                  quoted: mek, 
                  timeoutMs: fileSize > 1024 ** 3 ? 1800000 : 300000  // 30 min for >1GB, 5 min otherwise
                });
                documentSent = true;
                printMemoryUsage("After Document Send");
                console.log(`✅ Full document sent successfully (Attempt ${attempt})`);
              } catch (docErr) {
                console.error("❌ Document Send Error:", {
                  message: docErr.message,
                  code: docErr.code || 'N/A',
                  stack: docErr.stack,
                  attempt,
                  sizeGB,
                  downloadUrl: res.downloadUrl.substring(0, 50) + '...'
                });
                throw docErr;  // Fail the retry if document fails
              }

              // All sends successful
              printMemoryUsage("Upload Complete");
              console.log(`🎉 Full upload success (Attempt ${attempt}): Video=${videoSent ? 'Yes' : 'Skipped/No'}, Document=Yes, Size=${sizeGB}GB`);

              // Delete uploading indicator if sent
              if (uploadingMsg) {
                try {
                  await conn.sendMessage(remoteJid, { delete: uploadingMsg.key });
                } catch (deleteErr) {
                  console.warn("⚠️ Failed to delete uploading indicator:", deleteErr.message);
                }
              }

            } catch (uploadErr) {
              printMemoryUsage(`Upload Fail (Attempt ${attempt})`);
              console.error(`❌ Upload Failed (Attempt ${attempt}/3):`, {
                message: uploadErr.message,
                code: uploadErr.code || 'N/A',
                stack: uploadErr.stack,
                videoSent,
                documentSent,
                sizeGB,
                downloadUrl: res.downloadUrl.substring(0, 50) + '...',
                videoId,
                format
              });

              if (attempt < 3 && (uploadErr.message.includes('timeout') || uploadErr.message.includes('network') || uploadErr.message.includes('ECONNRESET') || uploadErr.message.includes('ETIMEDOUT'))) {
                console.log(`🔄 Retrying upload ${attempt + 1}/3 after 10s delay...`);
                await new Promise(r => setTimeout(r, 10000));  // 10s delay for recovery
                return sendWithRetry(attempt + 1);
              }
              // Delete uploading indicator on final failure
              if (uploadingMsg) {
                try {
                  await conn.sendMessage(remoteJid, { delete: uploadingMsg.key });
                } catch (deleteErr) {
                  console.warn("⚠️ Failed to delete uploading indicator on error:", deleteErr.message);
                }
              }
              // Throw detailed error for outer catch
              const errorMsg = `Upload failed after ${attempt} attempts. Likely cause: ${uploadErr.message.includes('timeout') ? 'Timeout (large file/network)' : uploadErr.message.includes('network') ? 'Network issue' : 'Unknown error'}. Video preview: ${videoSent ? 'Sent' : 'Skipped/Failed'}. Full file: ${documentSent ? 'Sent' : 'Failed'}.`;
              throw new Error(errorMsg);
            }
          };

          await sendWithRetry();

        }

        if (btnId === "api_info_vid") {
          await conn.sendMessage(remoteJid, {
            text: `
🧠 *Senal YT DL API Info*
👨‍💻 Developer: Mr Senal
📦 Project: Senal YT DL v2.0
🔗 Base URL: https://senalytdl.vercel.app/
🎥 Endpoints:
- /download?id=VIDEO_ID&format=FORMAT (Streams up to 2GB videos)
Available formats: ${formats.join(", ")}
ℹ️ *Streaming Note:* Bot streams files directly—no local storage. Large files (>500MB) take time based on server bandwidth.
            `.trim()
          }, { quoted: mek });
        }
      } catch (err) {
        printMemoryUsage("Outer Error Handler");
        console.error("❌ Overall YT Video Button Error:", {
          message: err.message,
          stack: err.stack,
          btnId,
          remoteJid,
          videoId: btnId.startsWith("dl_") ? btnId.split("_")[1] : 'N/A',
          format: btnId.startsWith("dl_") ? btnId.split("_")[2] : 'N/A'
        });
        conn.sendMessage(remoteJid, { 
          text: `❌ Button action failed: ${err.message}. Check bot console for full error details. Try again later.` 
        }, { quoted: mek });
      }
    });
  }
});
