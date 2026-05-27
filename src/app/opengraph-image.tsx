import { ImageResponse } from "next/og";

export const alt = "AI SNS Partner";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: "#ffffff",
          color: "#0f172a",
          padding: "72px",
          fontFamily: "Inter, Arial, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
            flexDirection: "column",
            justifyContent: "space-between",
            border: "2px solid #e2e8f0",
            borderRadius: "40px",
            background: "linear-gradient(135deg, #eff6ff 0%, #ffffff 55%, #ecfdf5 100%)",
            padding: "64px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div
              style={{
                display: "flex",
                width: "auto",
                borderRadius: "999px",
                background: "#2563eb",
                color: "#ffffff",
                padding: "14px 24px",
                fontSize: 30,
                fontWeight: 700,
              }}
            >
              SNS Operation Partner
            </div>
            <div style={{ fontSize: 86, fontWeight: 900, letterSpacing: -1 }}>
              AI SNS Partner
            </div>
          </div>
          <div style={{ display: "flex", gap: "24px", fontSize: 34, fontWeight: 700 }}>
            <span>Planning</span>
            <span style={{ color: "#10b981" }}>Human Review</span>
            <span>Monthly Report</span>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
