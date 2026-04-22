import os

path = os.path.join("app", "(fan)", "profile", "[id]", "page.tsx")

with open(path, "r", encoding="utf-8") as f:
    lines = f.readlines()

# Find the corrupted section: line 820 has "</div>" after hero,
# followed by orphaned JSX fragments starting with "key={n}"
# We need to find line 820 (</div> after hero image) and line 853 (</div> closing creator info)

# Strategy: find the orphaned "key={n}" line and work backwards to the </div> before it,
# then find the </div> that closes the creator info section.

start_idx = None
end_idx = None

for i, line in enumerate(lines):
    stripped = line.strip()
    if stripped == "key={n}" and start_idx is None:
        # The corrupted start is the line before this (the </div> closing hero)
        start_idx = i - 1
        break

if start_idx is None:
    print("ERROR: Could not find corrupted 'key={n}' line")
    exit(1)

# Find the end: look for the "About" heading section, then the closing </div> after it
for i in range(start_idx, len(lines)):
    stripped = lines[i].strip()
    if stripped == "</div>" and i > start_idx + 10:
        # Check if the previous non-empty lines contain the About/bio section
        prev_content = "".join(lines[start_idx:i+1])
        if "About" in prev_content and "creator.bio" in prev_content:
            end_idx = i
            break

if end_idx is None:
    print("ERROR: Could not find end of corrupted section")
    exit(1)

print(f"Found corrupted section: lines {start_idx + 1} to {end_idx + 1}")
print(f"Removing {end_idx - start_idx + 1} lines and replacing with fixed content")

# Build the replacement content
replacement = """          </div>\r
\r
          {/* Creator info */}\r
          <div className="px-4 pt-3">\r
            <div className="flex items-start justify-between gap-3">\r
              <div className="flex-1 min-w-0">\r
                <h1 className="text-xl font-bold text-brand-ink leading-tight">{creator.name}</h1>\r
                {hasPackages && (\r
                  <p className="text-sm text-brand-ink-muted mt-0.5">\r
                    {formatCurrency(creator.callPrice)} &bull; Session\r
                  </p>\r
                )}\r
                <p className="text-xs text-brand-ink-subtle mt-0.5">{creator.username}</p>\r
              </div>\r
              {creator.rating > 0 && (\r
                <div className="flex items-center gap-0.5 shrink-0 pt-0.5">\r
                  {[1, 2, 3, 4, 5].map((n) => (\r
                    <Star\r
                      key={n}\r
                      className={cn(\r
                        "w-3.5 h-3.5",\r
                        n <= Math.round(creator.rating) ? "fill-brand-gold text-brand-gold" : "text-brand-border"\r
                      )}\r
                    />\r
                  ))}\r
                </div>\r
              )}\r
            </div>\r
\r
            {/* Price pills */}\r
            <div className="flex flex-wrap gap-2 mt-2.5">\r
              {hasLiveRate && (\r
                <span className="inline-flex items-center gap-1 rounded-full border border-brand-live/25 bg-brand-live/5 px-3 py-1.5 text-xs font-semibold text-brand-live">\r
                  <Zap className="h-3 w-3" />\r
                  {formatCurrency(creator.liveJoinFee!)} / min\r
                </span>\r
              )}\r
              {hasPackages && (\r
                <span className="px-3 py-1.5 rounded-full border border-brand-border bg-brand-surface text-xs font-medium text-brand-ink">\r
                  from {formatCurrency(creator.callPrice)} / session\r
                </span>\r
              )}\r
            </div>\r
\r
            {mobileLiveCard}\r
\r
            {creator.bio && (\r
              <div className="mt-4 border-t border-brand-border pt-4">\r
                <h2 className="mb-2 text-base font-bold text-brand-ink">About</h2>\r
                <p className="text-sm leading-relaxed text-brand-ink-muted">{creator.bio}</p>\r
              </div>\r
            )}\r
          </div>\r
"""

new_lines = lines[:start_idx] + [replacement] + lines[end_idx + 1:]

with open(path, "w", encoding="utf-8") as f:
    f.writelines(new_lines)

print("SUCCESS: Fixed corrupted section and added mobileLiveCard above About")
