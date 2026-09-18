const AVATAR_PALETTE = ['#6f5bd6', '#2a8f9e', '#c8791f', '#3f7d4f', '#a2456f', '#3d6fa8'];

export function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}
