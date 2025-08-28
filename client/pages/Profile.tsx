import { useEffect, useState } from "react";
import Avatar from "boring-avatars";
import { AvatarPicker } from "@/components/profile/avatar-picker";
import { api } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Profile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [me, setMe] = useState<any>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [avatarSeed, setAvatarSeed] = useState<string|undefined>(undefined);
  const [avatarVariant, setAvatarVariant] = useState<string|undefined>(undefined);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const response = await api("/api/me");
        const m = response.user || response; // Handle both nested and flat responses
        setMe(m);
        setName(m?.name || "");
        setEmail(m?.email || "");
        setPhone(m?.phone || "");
        setAvatarUrl(m?.avatar_url || "");
        setAvatarSeed(m?.avatar_seed || undefined);
        setAvatarVariant(m?.avatar_variant || undefined);
      } catch (e: any) {
        setError(e?.message || "Failed to load profile");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Avatar preview component
  function AvatarPreview() {
    const colors = ["#92A1C6", "#146A7C", "#F0AB3D", "#C271B4", "#C20D90"];
    
    if (avatarSeed && avatarVariant) {
      return (
        <div className="h-16 w-16 rounded-full overflow-hidden">
          <Avatar size={64} name={avatarSeed} variant={avatarVariant as any} colors={colors} />
        </div>
      );
    }
    if (avatarUrl) {
      return <img src={avatarUrl} alt="avatar" className="h-16 w-16 rounded-full object-cover" />;
    }
    return <div className="h-16 w-16 rounded-full bg-gray-200" />;
  }

  async function saveProfile() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await api("/api/me", {
        method: "PUT",
        body: JSON.stringify({
          name,
          phone,
          avatar_url: avatarSeed ? null : (avatarUrl || null),
          avatar_seed: avatarSeed || null,
          avatar_variant: avatarSeed ? (avatarVariant || "beam") : null,
        }),
      });
      setMessage("Profile updated successfully!");
    } catch (e: any) {
      setError(e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="page">Loading…</div>;

  return (
    <div className="page space-y-6">
      <div className="header-row">
        <h1 className="text-2xl font-bold">Profile</h1>
      </div>

      {message && <div className="mb-3 p-3 bg-green-100 text-green-700 rounded">{message}</div>}
      {error && <div className="mb-3 p-3 bg-red-100 text-red-700 rounded">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Avatar</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <AvatarPreview />
            </div>

            <AvatarPicker
              value={{ seed: avatarSeed, variant: (avatarVariant as any) || "beam" }}
              onSelect={(v) => {
                setAvatarSeed(v.seed);
                setAvatarVariant(v.variant);
                // selecting a generated avatar clears uploaded image URL
                if (v.seed) setAvatarUrl("");
              }}
            />

            <div className="pt-2">
              <Button onClick={saveProfile} disabled={saving}>
                {saving ? "Saving…" : "Save Profile"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Personal Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                disabled
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Phone</label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 234 567 8900"
              />
            </div>
            <div className="pt-2">
              <Button onClick={saveProfile} disabled={saving}>
                {saving ? "Saving…" : "Save Profile"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}