import os

path = os.path.join("app", "(fan)", "profile", "[id]", "page.tsx")

with open(path, "rb") as f:
    content = f.read()

# Fix double \r\r\n to just \r\n
content = content.replace(b"\r\r\n", b"\r\n")

with open(path, "wb") as f:
    f.write(content)

print("Fixed double CRLF line endings")

# Now read as text and remove orphaned lines 873-874
with open(path, "r", encoding="utf-8") as f:
    lines = f.readlines()

# Find the orphaned "            )}" and "          </div>" after the About section closing </div>
# These appear right after "          </div>" (closing creator info)
for i, line in enumerate(lines):
    if "{mobileLiveCard}" in line:
        # The About section should close with </div> for the bio, then )} for the conditional, then </div> for the creator info div
        # After that, there may be orphaned lines
        # Let's find the creator info closing </div>
        j = i + 1
        while j < len(lines):
            stripped = lines[j].strip()
            if stripped == "</div>" and lines[j].startswith("          </div>"):
                # This is the creator info closing div
                # Check if the next lines are orphaned
                k = j + 1
                if k < len(lines) and lines[k].strip() == ")}":
                    # Check next
                    k2 = k + 1
                    if k2 < len(lines) and lines[k2].strip() == "</div>":
                        # These two lines (k and k2) are orphaned - remove them
                        print(f"Found orphaned lines at {k+1} and {k2+1}, removing them")
                        del lines[k:k2+1]
                        break
                j += 1
        break

with open(path, "w", encoding="utf-8") as f:
    f.writelines(lines)

print("Done cleaning up")
