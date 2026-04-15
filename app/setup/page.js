"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db, storage } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

const GENRE_TAGS = [
  "SF", "恋愛", "ミステリー", "サスペンス", "ファンタジー", "ラノベ",
  "歴史", "ホラー", "純文学", "ノンフィクション", "その他",
];

export default function SetupPage() {
  const { user, userData } = useAuth();
  const router = useRouter();
  const iconInputRef = useRef(null);

  const [iconFile, setIconFile] = useState(null);
  const [iconPreview, setIconPreview] = useState(null);
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user === null) { router.push("/login"); return; }
    if (userData?.setupCompleted) { router.push("/home"); return; }
  }, [user, userData, router]);

  function handleIconChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setIconFile(file);
    setIconPreview(URL.createObjectURL(file));
  }

  function toggleGenre(genre) {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  }

  async function handleSubmit() {
    setSaving(true);
    const update = { setupCompleted: true, genres: selectedGenres };
    if (iconFile) {
      const storageRef = ref(storage, `icons/${user.uid}`);
      await uploadBytes(storageRef, iconFile);
      update.iconUrl = await getDownloadURL(storageRef);
    }
    await updateDoc(doc(db, "users", user.uid), update);
    router.push("/home");
  }

  if (user === undefined) return null;

  return (
    <>
      <style>{`
        .setup-wrap {
          min-height:100vh; display:flex; flex-direction:column;
          align-items:center; justify-content:center;
          background:var(--bg2); padding:40px 20px;
        }
        .setup-box {
          background:white; border:1px solid var(--line);
          padding:60px 48px; width:100%; max-width:480px;
        }
        @media(max-width:540px){ .setup-box { padding:40px 24px; } }

        .setup-kicker {
          font-size:10px; font-weight:500; letter-spacing:4px; color:var(--muted);
          text-transform:uppercase; margin-bottom:12px;
        }
        .setup-heading {
          font-size:26px; font-weight:900; color:var(--text);
          letter-spacing:-1px; margin-bottom:8px; line-height:1.2;
        }
        .setup-sub {
          font-size:13px; color:var(--muted); line-height:1.9; margin-bottom:40px;
        }

        .setup-section-label {
          font-size:10px; font-weight:500; letter-spacing:3px; color:var(--muted);
          text-transform:uppercase; margin-bottom:16px; padding-bottom:10px;
          border-bottom:1px solid var(--line);
        }
        .setup-section { margin-bottom:36px; }

        .icon-area { display:flex; align-items:center; gap:20px; }
        .icon-preview {
          width:72px; height:72px; border-radius:50%; object-fit:cover;
          border:1px solid var(--line); flex-shrink:0;
        }
        .icon-placeholder {
          width:72px; height:72px; border-radius:50%;
          background:var(--bg3); border:1px solid var(--line);
          flex-shrink:0; display:flex; align-items:center; justify-content:center;
          font-size:11px; color:var(--muted); letter-spacing:0.5px;
        }
        .icon-upload-btn {
          background:none; border:1px solid var(--line); padding:9px 20px;
          font-size:12px; color:var(--text); cursor:pointer;
          font-family:'Noto Sans JP',sans-serif; transition:border-color 0.2s;
        }
        .icon-upload-btn:hover { border-color:var(--text); }

        .genre-grid {
          display:flex; flex-wrap:wrap; gap:8px;
        }
        .genre-tag {
          padding:7px 14px; font-size:12px; border:1px solid var(--line);
          cursor:pointer; transition:all 0.15s; color:var(--muted);
          font-family:'Noto Sans JP',sans-serif; background:white;
        }
        .genre-tag:hover { border-color:var(--text); color:var(--text); }
        .genre-tag.selected { background:var(--text); color:white; border-color:var(--text); }

        .setup-btn {
          width:100%; padding:15px; background:var(--text); color:white;
          border:none; font-size:14px; font-weight:500; cursor:pointer;
          font-family:'Noto Sans JP',sans-serif; letter-spacing:0.5px;
          transition:opacity 0.2s; margin-top:8px;
        }
        .setup-btn:hover { opacity:0.75; }
        .setup-btn:disabled { opacity:0.4; cursor:not-allowed; }

        .trial-badge {
          background:var(--bg2); border:1px solid var(--line);
          padding:12px 16px; font-size:12px; color:var(--muted);
          line-height:1.8; margin-bottom:32px;
        }
        .trial-badge strong { color:var(--text); }
      `}</style>

      <div className="setup-wrap">
        <div className="setup-box">
          <p className="setup-kicker">ようこそ</p>
          <h1 className="setup-heading">プロフィールを設定する</h1>
          <p className="setup-sub">あとからいつでも変更できます。</p>

          <div className="trial-badge">
            <strong>2ヶ月間プレミアム無料トライアル中</strong><br />
            登録から60日間、すべてのプレミアム機能を無料でお試しいただけます。
          </div>

          <div className="setup-section">
            <div className="setup-section-label">アイコン画像</div>
            <div className="icon-area">
              {iconPreview
                ? <img src={iconPreview} alt="icon" className="icon-preview" />
                : <div className="icon-placeholder">No Icon</div>
              }
              <div>
                <button className="icon-upload-btn" onClick={() => iconInputRef.current?.click()}>
                  画像を選ぶ
                </button>
                <input
                  ref={iconInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handleIconChange}
                />
              </div>
            </div>
          </div>

          <div className="setup-section">
            <div className="setup-section-label">好きなジャンル（複数可）</div>
            <div className="genre-grid">
              {GENRE_TAGS.map((genre) => (
                <button
                  key={genre}
                  className={`genre-tag${selectedGenres.includes(genre) ? " selected" : ""}`}
                  onClick={() => toggleGenre(genre)}
                >
                  {genre}
                </button>
              ))}
            </div>
          </div>

          <button className="setup-btn" onClick={handleSubmit} disabled={saving}>
            {saving ? "保存中..." : "カタリバをはじめる"}
          </button>
        </div>
      </div>
    </>
  );
}
