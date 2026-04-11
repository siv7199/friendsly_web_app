export async function uploadAvatarFile(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/profile/avatar", {
    method: "POST",
    body: formData,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "Could not upload avatar.");
  }

  return data.avatarUrl as string;
}

export async function removeAvatarFile() {
  const response = await fetch("/api/profile/avatar", {
    method: "DELETE",
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "Could not remove avatar.");
  }
}
