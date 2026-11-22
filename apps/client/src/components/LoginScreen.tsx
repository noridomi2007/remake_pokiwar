import { ELEMENT_META, getPetById, getPetSpritePath, type PetDef } from '@pokiwar/shared';
import { useEffect, useState, type FormEvent } from 'react';
import type { PlayerProgress } from './MainLobby.js';

export interface AuthSessionPayload {
  token: string | null;
  username: string;
  displayName: string;
  serverId: string;
  isGuest: boolean;
  progress?: PlayerProgress;
}

interface LoginScreenProps {
  serverOnline: boolean;
  onAuthenticated: (session: AuthSessionPayload) => void;
}

const SAVED_CREDS_KEY = 'pokiwar_saved_creds_v1';
const LOCAL_ACCOUNTS_KEY = 'pokiwar_local_accounts_v1';

const STARTER_CHOICES: PetDef[] = [
  getPetById('pet-583'),
  getPetById('pet-1431'),
  getPetById('pet-725'),
];

const SERVERS = [
  { id: 'S1', label: 'S1: Đảo Khởi Đầu' },
  { id: 'S2', label: 'S2: Thập Nhị Tinh Mộ' },
] as const;

interface LocalAccountEntry {
  username: string;
  displayName: string;
  password: string;
  starterPetId: string;
  progress: PlayerProgress;
}

function readLocalAccounts(): Record<string, LocalAccountEntry> {
  try {
    const raw = localStorage.getItem(LOCAL_ACCOUNTS_KEY);
    if (raw) return JSON.parse(raw) as Record<string, LocalAccountEntry>;
  } catch {
    // ignore
  }
  return {};
}

function writeLocalAccounts(map: Record<string, LocalAccountEntry>): void {
  try {
    localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function LoginScreen({ serverOnline: _serverOnline, onAuthenticated }: LoginScreenProps) {
  const [username, setUsername] = useState('pokiwar');
  const [password, setPassword] = useState('123456');
  const [showPass, setShowPass] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [serverId, setServerId] = useState<string>('S1');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Register Modal State (ManagerRegister)
  const [showRegister, setShowRegister] = useState(false);
  const [regName, setRegName] = useState('');
  const [regUser, setRegUser] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [regStarterId, setRegStarterId] = useState('pet-583');
  const [regError, setRegError] = useState<string | null>(null);
  const [regSuccess, setRegSuccess] = useState<string | null>(null);
  const [regLoading, setRegLoading] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SAVED_CREDS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as {
          username?: string;
          password?: string;
          remember?: boolean;
          serverId?: string;
        };
        if (parsed.remember) {
          setUsername(parsed.username ?? 'pokiwar');
          setPassword(parsed.password ?? '123456');
          setRememberMe(true);
          if (parsed.serverId) setServerId(parsed.serverId);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const persistRemembered = (userVal: string, passVal: string) => {
    try {
      if (rememberMe) {
        localStorage.setItem(
          SAVED_CREDS_KEY,
          JSON.stringify({ username: userVal, password: passVal, remember: true, serverId }),
        );
      } else {
        localStorage.removeItem(SAVED_CREDS_KEY);
      }
    } catch {
      // ignore
    }
  };

  const handleLoginSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const cleanUser = username.trim();
    if (!cleanUser || !password) {
      setErrorMsg('Vui lòng nhập đầy đủ Tên đăng nhập và Mật khẩu.');
      return;
    }

    setLoading(true);
    try {
      const resp = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUser, password, serverId }),
      });
      const data = (await resp.json()) as {
        ok?: boolean;
        message?: string;
        token?: string;
        user?: { username: string; displayName: string; serverId: string };
        progress?: PlayerProgress;
      };

      if (resp.ok && data.ok && data.user) {
        persistRemembered(cleanUser, password);
        onAuthenticated({
          token: data.token ?? null,
          username: data.user.username,
          displayName: data.user.displayName,
          serverId: data.user.serverId,
          isGuest: false,
          progress: data.progress,
        });
        return;
      }

      setErrorMsg(data.message ?? 'Đăng nhập thất bại. Vui lòng kiểm tra lại.');
    } catch {
      // Offline / local fallback verification
      const local = readLocalAccounts();
      const hit = local[cleanUser.toLowerCase()];
      if (hit && hit.password === password) {
        persistRemembered(cleanUser, password);
        onAuthenticated({
          token: null,
          username: hit.username,
          displayName: hit.displayName,
          serverId,
          isGuest: false,
          progress: hit.progress,
        });
        return;
      }
      if (cleanUser.toLowerCase() === 'pokiwar' && password === '123456') {
        persistRemembered(cleanUser, password);
        onAuthenticated({
          token: null,
          username: 'pokiwar',
          displayName: 'Potter',
          serverId,
          isGuest: false,
        });
        return;
      }
      setErrorMsg('Không kết nối được máy chủ xác thực. Hãy thử Chơi Ngay (Khách) hoặc kiểm tra server.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setRegError(null);
    setRegSuccess(null);

    const cleanUser = regUser.trim().toLowerCase();
    const cleanName = regName.trim();

    if (!cleanName) {
      setRegError('Vui lòng nhập Tên nhân vật hiển thị.');
      return;
    }
    if (!/^[a-z0-9_]{3,20}$/.test(cleanUser)) {
      setRegError('Tên đăng nhập gồm 3–20 ký tự chữ thường, số hoặc _.');
      return;
    }
    if (regPass.length < 4) {
      setRegError('Mật khẩu phải có ít nhất 4 ký tự.');
      return;
    }
    if (regPass !== regConfirm) {
      setRegError('Mật khẩu xác nhận không khớp.');
      return;
    }

    setRegLoading(true);
    try {
      const resp = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: cleanUser,
          displayName: cleanName,
          password: regPass,
          starterPetId: regStarterId,
          serverId,
        }),
      });
      const data = (await resp.json()) as {
        ok?: boolean;
        message?: string;
        token?: string;
        user?: { username: string; displayName: string; serverId: string };
        progress?: PlayerProgress;
      };

      if (resp.ok && data.ok && data.user) {
        setUsername(data.user.username);
        setPassword(regPass);
        persistRemembered(data.user.username, regPass);
        setRegSuccess('Đăng ký thành công! Đang vào Vương Quốc Pokiwar...');
        setTimeout(() => {
          setShowRegister(false);
          onAuthenticated({
            token: data.token ?? null,
            username: data.user!.username,
            displayName: data.user!.displayName,
            serverId: data.user!.serverId,
            isGuest: false,
            progress: data.progress,
          });
        }, 650);
        return;
      }

      setRegError(data.message ?? 'Không thể đăng ký tài khoản.');
    } catch {
      const local = readLocalAccounts();
      if (local[cleanUser]) {
        setRegError('Tên đăng nhập đã tồn tại.');
        return;
      }
      const starterProgress: PlayerProgress = {
        name: cleanName,
        avatarId: '29',
        unlockedAvatars: ['29'],
        level: 1,
        exp: 0,
        gold: 1500,
        stones: 25,
        stoneBag: [8, 4, 2, 1, 0],
        wins: 0,
        worldBossBestDamage: 0,
        wheelSpunCount: 0,
        selectedPetId: regStarterId,
        petLevels: { [regStarterId]: 1 },
        petTiers: {},
        clearedStages: [],
        claimedMissions: [],
      };
      local[cleanUser] = {
        username: cleanUser,
        displayName: cleanName,
        password: regPass,
        starterPetId: regStarterId,
        progress: starterProgress,
      };
      writeLocalAccounts(local);
      setUsername(cleanUser);
      setPassword(regPass);
      persistRemembered(cleanUser, regPass);
      setShowRegister(false);
      onAuthenticated({
        token: null,
        username: cleanUser,
        displayName: cleanName,
        serverId,
        isGuest: false,
        progress: starterProgress,
      });
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <div className="pk-login-root">
      <img
        src="/assets/pokiguard/sprites/login.png"
        alt="Pokiwar Login Backdrop"
        className="pk-login-bg"
      />

      {/* CLEAN HERO CREST & AUTHENTIC ZING ME PET SHOWCASE */}
      <div className="pk-login-crest">
        <div
          style={{
            fontSize: 36,
            fontWeight: 900,
            letterSpacing: 3.5,
            background: 'linear-gradient(180deg, #fffbeb 0%, #fde047 50%, #ea580c 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 3px 0 #451a03) drop-shadow(0 0 18px rgba(250, 204, 21, 0.75))',
            lineHeight: 1.05,
            marginBottom: 4,
          }}
        >
          POKIWAR
        </div>

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
          <img
            src="/assets/pokiguard/sprites/haoquang.png"
            alt=""
            className="pk-login-aura"
          />
          <img
            src="/assets/pokiguard/pets/pw_mega_zidarose.png"
            alt="Mega Zidarose"
            className="pk-login-pet"
            style={{ width: 102, height: 102 }}
          />
          <img
            src="/assets/pokiguard/pets/pw_mega_icarus.png"
            alt="Mega Icarus"
            className="pk-login-pet pk-login-pet-delay"
            style={{ width: 102, height: 102 }}
          />
        </div>
      </div>

      {errorMsg && (
        <div
          style={{
            position: 'absolute',
            top: '42.4%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 270,
            zIndex: 13,
            padding: '4px 10px',
            borderRadius: 8,
            background: 'rgba(127, 29, 29, 0.94)',
            border: '1.5px solid #f87171',
            fontSize: 11,
            fontWeight: 800,
            color: '#fecaca',
            textAlign: 'center',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.65)',
          }}
        >
          {errorMsg}
        </div>
      )}

      {/* EXACT PAINTED SHIELD INPUTS + GOLDEN LOGIN BUTTON OVERLAY */}
      <form onSubmit={handleLoginSubmit}>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Tên đăng nhập..."
          autoComplete="username"
          aria-label="Tên đăng nhập"
          className="pk-login-shield-input"
          style={{ top: '47.9%', left: '42.3%', width: '17.8%', height: '4.4%' }}
        />

        <input
          type={showPass ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mật khẩu..."
          autoComplete="current-password"
          aria-label="Mật khẩu"
          className="pk-login-shield-input"
          style={{ top: '54.9%', left: '42.3%', width: '14.8%', height: '4.4%' }}
        />

        <button
          type="button"
          onClick={() => setShowPass((v) => !v)}
          title={showPass ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          style={{
            position: 'absolute',
            top: '55.1%',
            left: '57.3%',
            width: '2.7%',
            height: '4.0%',
            background: 'rgba(15, 23, 42, 0.45)',
            border: '1px solid rgba(147, 197, 253, 0.5)',
            borderRadius: 6,
            color: '#e2e8f0',
            fontSize: 10,
            fontWeight: 800,
            cursor: 'pointer',
            zIndex: 12,
          }}
        >
          {showPass ? 'Ẩn' : 'Xem'}
        </button>

        <button
          type="submit"
          disabled={loading}
          className="pk-login-shield-submit"
          style={{ top: '62.7%', left: '39.8%', width: '20.5%', height: '5.8%' }}
        >
          {loading ? 'ĐANG VÀO GAME...' : 'ĐĂNG NHẬP'}
        </button>
      </form>

      {/* EXTRA CONTROLS UNDER THE SHIELD BUTTON */}
      <div
        style={{
          position: 'absolute',
          top: '70.2%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 236,
          zIndex: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10.5 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#e2e8f0', fontWeight: 700, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              style={{ accentColor: '#facc15', width: 14, height: 14 }}
            />
            Ghi nhớ
          </label>

          <select
            value={serverId}
            onChange={(e) => setServerId(e.target.value)}
            aria-label="Chọn máy chủ"
            style={{
              padding: '3px 7px',
              borderRadius: 7,
              background: '#09193c',
              border: '1.5px solid #38bdf8',
              color: '#fef08a',
              fontSize: 10.5,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            {SERVERS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            className="pk-btn-blue"
            style={{ flex: 1, padding: '6px 8px', fontSize: 11.5 }}
            onClick={() => {
              setRegError(null);
              setRegSuccess(null);
              setShowRegister(true);
            }}
          >
            Đăng Ký
          </button>
          <button
            type="button"
            className="pk-btn-gold"
            style={{ flex: 1, padding: '6px 8px', fontSize: 11.5 }}
            onClick={() =>
              onAuthenticated({
                token: null,
                username: 'guest',
                displayName: 'Potter',
                serverId,
                isGuest: true,
              })
            }
          >
            Chơi Ngay
          </button>
        </div>
      </div>

      {/* ==================== MODAL: ĐĂNG KÝ TÀI KHOẢN & CHỌN PET KHỞI ĐẦU ==================== */}
      {showRegister && (
        <div className="stage-modal-backdrop" onClick={() => setShowRegister(false)}>
          <div className="pk-modal" style={{ maxWidth: 660 }} onClick={(e) => e.stopPropagation()}>
            <div className="pk-modal-header">
              <div style={{ width: 38 }} />
              <div className="pk-ribbon-title">ĐĂNG KÝ TÀI KHOẢN MỚI</div>
              <button
                type="button"
                className="pk-close-orb"
                aria-label="Đóng"
                title="Đóng"
                onClick={() => setShowRegister(false)}
              >
                <img src="/assets/pokiguard/sprites/btnClose.png" alt="Đóng" />
              </button>
            </div>

            <form onSubmit={handleRegisterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 800, color: '#fde047', display: 'block', marginBottom: 4 }}>
                    Tên nhân vật (hiển thị trong game):
                  </label>
                  <input
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="VD: ThầnThúSư"
                    maxLength={20}
                    className="pk-form-input"
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 800, color: '#fde047', display: 'block', marginBottom: 4 }}>
                    Tên đăng nhập (a-z, 0-9, _):
                  </label>
                  <input
                    value={regUser}
                    onChange={(e) => setRegUser(e.target.value)}
                    placeholder="VD: thanthu99"
                    maxLength={20}
                    className="pk-form-input"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 800, color: '#fde047', display: 'block', marginBottom: 4 }}>
                    Mật khẩu (tối thiểu 4 ký tự):
                  </label>
                  <input
                    type="password"
                    value={regPass}
                    onChange={(e) => setRegPass(e.target.value)}
                    placeholder="••••••"
                    className="pk-form-input"
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 800, color: '#fde047', display: 'block', marginBottom: 4 }}>
                    Xác nhận mật khẩu:
                  </label>
                  <input
                    type="password"
                    value={regConfirm}
                    onChange={(e) => setRegConfirm(e.target.value)}
                    placeholder="••••••"
                    className="pk-form-input"
                  />
                </div>
              </div>

              {/* Starter Pet Choice */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 900, color: '#7dd3fc', marginBottom: 6 }}>
                  Chọn Thú Cưng Khởi Đầu đồng hành cùng bạn:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                  {STARTER_CHOICES.map((pet) => {
                    const selected = regStarterId === pet.id;
                    return (
                      <button
                        key={pet.id}
                        type="button"
                        onClick={() => setRegStarterId(pet.id)}
                        className="pk-stone-panel"
                        style={{
                          padding: 8,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 4,
                          cursor: 'pointer',
                          borderColor: selected ? '#fde047' : '#334155',
                          boxShadow: selected ? '0 0 18px rgba(250, 204, 21, 0.65)' : undefined,
                        }}
                      >
                        <img
                          src={getPetSpritePath(pet, 'BASE')}
                          alt={pet.name}
                          style={{ width: 64, height: 64, objectFit: 'contain' }}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <img src={ELEMENT_META[pet.element].iconPath} alt="" style={{ width: 15, height: 15 }} />
                          <span style={{ fontSize: 11.5, fontWeight: 900, color: selected ? '#fde047' : '#fff' }}>
                            {pet.name}
                          </span>
                        </div>
                        <span style={{ fontSize: 10, color: '#94a3b8' }}>Hệ {ELEMENT_META[pet.element].label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {regError && (
                <div style={{ color: '#fda4af', fontSize: 12.5, fontWeight: 800, textAlign: 'center' }}>
                  {regError}
                </div>
              )}
              {regSuccess && (
                <div style={{ color: '#4ade80', fontSize: 12.5, fontWeight: 800, textAlign: 'center' }}>
                  {regSuccess}
                </div>
              )}

              <button
                type="submit"
                className="pk-btn-gold"
                disabled={regLoading}
                style={{ padding: '11px 20px', fontSize: 14, marginTop: 4 }}
              >
                {regLoading ? 'Đang tạo tài khoản...' : 'TẠO NHÂN VẬT & VÀO GAME'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
