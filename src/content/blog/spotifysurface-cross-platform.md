---
title: "Making SpotifySurface cross-platform: a revoked token, decoy lyrics and CI without a Mac"
description: "Getting a Windows-only Spotify lyrics window running again, then on macOS and Linux: a revoked refresh token, Musixmatch returning a fake song instead of an error, a fragile LRC parser, per-OS media control, and why macOS didn't stay in the GitHub Actions matrix."
pubDate: 2026-11-19
updatedDate: 2026-11-19
tags: ["python", "tkinter", "spotify", "cross-platform", "github-actions", "lyrics"]
---

I wanted to make a small Windows-only app run on macOS and Linux. Before I could, I had to get it running at all.

[SpotifySurface](https://github.com/PureAspiration/SpotifySurface) is a small always-on-top Tkinter window that shows what's playing on Spotify, with lyrics synced to the song. I hadn't run it for a while. It crashed on startup, and once that was fixed it showed confident, perfectly timed lyrics in a language nobody speaks. Only after those fixes could I start on the cross-platform work.

This post covers the four fixes in the order I hit them, then the cross-platform work and how it's tested in CI, including why macOS didn't stay in the CI matrix.

## TL;DR

| Problem | Cause | Fix |
|---|---|---|
| `KeyError: 'access_token'` on startup | Spotify revoked the refresh token; the code never checked the response | Check the status and exit with a clear message; a script to get a new token |
| `KeyError: 'album_coverart_100x100'` | Musixmatch dropped fields from its response | Read every field with `.get()` |
| `invalid literal for int()` in the lyrics parser | LRC lines with no space after `]` | A regex-based LRC parser |
| Gibberish lyrics for the wrong song | A blocked Musixmatch token returns a **decoy song**, not an error | [LRCLIB](https://lrclib.net) first, and reject results for a different song |
| Only runs on Windows | `pywin32`, `winsdk` and a Windows-only Tk attribute imported at the top | One `platform_support.py` module with a branch per OS |

## 1. The refresh token that wasn't

The first run died like this:

```
Code 400: Bad Request
{'error': 'invalid_grant', 'error_description': 'Refresh token revoked'}
Spotify token refreshed
KeyError: 'access_token'
```

The response said exactly what was wrong, and the code printed "Spotify token refreshed" anyway, then crashed reading a key that wasn't there. Refresh tokens don't last forever: the Spotify dashboard shows a **Refresh Token Lifetime of 180 days**, and a token is revoked earlier if you reset the client secret or remove the app's access.

The fix is to check before trusting the response:

```python
if response.status_code != 200 or "access_token" not in response.json():
    error = response.json().get("error_description", response.reason)
    print(f"[ERROR] Spotify token refresh failed: {error}")
    print("Generate a new refresh token and update .env")
    sys.exit(1)
```

There were two smaller bugs in the same function. The connection-error retry said "retrying in 10 seconds" and then called `time.sleep(1000)`, about 17 minutes. And the recursive retry didn't `return` its result, so even a successful retry handed back `None`.

Getting a new token used to mean pasting a URL into a browser, copying a `code` out of the redirect and running `curl`. I replaced that with a small script that opens the login page, runs a one-shot HTTP server on `127.0.0.1` to catch the redirect, checks the `state` parameter, exchanges the code and writes the new refresh token into `.env`.

Two gotchas while doing this:

- **Spotify no longer accepts `localhost` as a redirect URI.** Use `http://127.0.0.1:8888/callback`, exactly, with no trailing slash.
- **`redirect_uri: Not matching configuration`** can mean the URI *is* registered, just on a different app. I had several apps in the dashboard, and the client ID inside my Base64 token belonged to a different one than I was editing. Decoding the token's client ID and comparing its first few characters with the dashboard settled it.

## 2. Musixmatch fields that disappeared

With auth working, the lyrics lookup crashed:

```
KeyError: 'album_coverart_100x100'
```

The code read every field from Musixmatch's response with `meta["track"][...]`. An undocumented API changes under you, and these cover-art fields were gone. Every field now goes through `.get()` with a sensible default. If Musixmatch doesn't send a track length, the duration Spotify already gave us is kept instead of being overwritten with `0`.

## 3. An LRC parser that needed a space

Next:

```
ValueError: invalid literal for int() with base 10: '00]Wob gopini den'
```

Synced lyrics come as LRC: `[mm:ss.xx] text` per line. The parser split on `"] "` with a space, so `[00:00.00]Wob gopini den` broke it. I replaced the string-splitting with one regex. The space is optional, the fraction can be 1–3 digits, and lines that don't match (like `[ar:Artist]` tags) are skipped instead of crashing:

```python
match = re.match(r"^\s*\[(\d+):(\d+)(?:[.:](\d+))?\]\s*(.*)$", line)
if not match:
    continue
minutes, seconds, fraction, text = match.groups()
epoch = int(minutes) * 60000 + int(seconds) * 1000
if fraction:
    epoch += int(fraction.ljust(3, "0")[:3])  # "5", "50" and "500" all mean 500 ms
```

## 4. The decoy song

The app finally ran, and showed this for *Bella Ciao*:

```
Searching lyrics: Drake - NOKIA
[[12000, 16000], 'Wob gopini den'], [[16000, 20000], 'Tefe woxica fero'], ...
```

The song was wrong, every line was exactly four seconds long, and the words were nonsense. The track length was missing too. This is what Musixmatch returns to a **blocked or rate-limited token**: it doesn't send an error, it sends a plausible-looking fake song. That's nasty, because nothing fails. The parser is happy and the UI scrolls along nicely.

Two changes:

1. **Look up [LRCLIB](https://lrclib.net) first.** It's a free, open lyrics database with synced lyrics and no token. `GET /api/get` takes artist, track, album and duration. If there's no exact match, `GET /api/search` and pick the result whose duration is within 5 seconds of the Spotify track.
2. **Check that Musixmatch matched the song you asked for.** It's now only a fallback, and its result is thrown away if the title or artist doesn't match. Titles are normalised first, so `Bella Ciao - Música Original de la Serie...` still matches `Bella Ciao`, but `Drake - NOKIA` doesn't.

## 5. Making it cross-platform

Only now could I do what I'd set out to do. Three things tied the app to Windows:

| Windows-only code | Used for |
|---|---|
| `winsdk` media session | Reading what's playing on this computer |
| `win32api.keybd_event` media keys | Play/pause/skip **without Spotify Premium** (the Web API's playback endpoints need Premium) |
| `root.attributes("-transparentcolor", ...)` | A transparent colour; this Tk attribute only exists on Windows |

The first two were imported at the top of `main.py`, so on macOS or Linux the app died before opening a window.

All of it moved into one module, `platform_support.py`, with the same two functions on each OS:

| | Read the current track | Send play/pause/next/previous |
|---|---|---|
| Windows | `winsdk` media session | Media keys via `pywin32` |
| macOS | `osascript`: `name of current track` | `osascript`: `tell application "Spotify" to playpause` |
| Linux | `playerctl --player=spotify metadata title` | `playerctl --player=spotify play-pause` |

```python
def send_media_command(action):
    if IS_MAC:
        if not _mac_spotify_running():
            return False
        command = {"previous": "previous track", "play_pause": "playpause", "next": "next track"}[action]
        return _run(["osascript", "-e", f'tell application "Spotify" to {command}']) is not None
    if IS_LINUX:
        if not shutil.which("playerctl"):
            return False
        command = {"previous": "previous", "play_pause": "play-pause", "next": "next"}[action]
        return _run(["playerctl", "--player=spotify", command]) is not None
    ...
```

Each function returns `False` or `None` when its tool isn't there, and the button falls back to the Spotify Web API. Nothing crashes because `playerctl` isn't installed.

The rest was small:

- **Dependencies:** `pywin32` and `winsdk` get environment markers in `requirements.txt` (`; sys_platform == "win32"`), so pip skips them elsewhere.
- **Paths:** `f"{code_directory}\\api_data.json"` became `os.path.join(...)`.
- **Taskbar height:** a hardcoded 60 px became the real work area from `GetMonitorInfo` on Windows (52 px on my screen, so it had been slightly wrong all along), with sensible defaults for the Dock and Linux panels.
- **`-transparentcolor`:** only applied on Windows. When I checked what it was for, nothing in the UI was actually drawn in that colour, so skipping it elsewhere changes nothing.

One macOS gotcha: AppleScript addressing an app that isn't installed pops up a **"Where is Spotify?"** dialog and blocks. So the code checks `pgrep -x Spotify` before it runs any AppleScript. Every subprocess call also has a 3-second timeout.

## 6. Testing three OSes in CI

I only have Windows here, so the other two platforms had to be tested another way. The tests do it two ways:

- **Every branch on every runner.** The tests patch the `IS_WINDOWS`/`IS_MAC`/`IS_LINUX` flags and mock `subprocess.run`, `shutil.which` and `win32api`. The Linux branch is exercised on the Windows runner and the other way round. They check the exact commands sent, and what happens when the tool is missing, times out, or Spotify isn't running.
- **Real calls on the native OS.** One unmocked test per runner checks that the real calls don't crash. Spotify isn't running in CI, so the answer should be "nothing playing", not an exception.

The lyrics tests replay the exact inputs that broke: the no-space LRC line, the `Drake - NOKIA` decoy, the missing cover-art fields and the revoked-token response.

The workflow is a plain matrix:

```yaml
on:
  push:
    branches: [master]
  pull_request:

concurrency:
  group: tests-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true

strategy:
  fail-fast: false
  matrix:
    os: [windows-latest, ubuntu-latest]
    python-version: ["3.10"]
steps:
  - uses: actions/checkout@v4
  - uses: actions/setup-python@v5
    with:
      python-version: ${{ matrix.python-version }}
  - run: pip install -r requirements-dev.txt
  - run: python -c "import main, platform_support, get_refresh_token"
  - run: pytest -v
```

The import step is there on purpose: a Windows-only import at the top of `main.py` was the original bug, and this catches it coming back.

On the latest commit both jobs pass: Ubuntu in about 23 seconds, Windows in about a minute.

### Why macOS isn't in the matrix

The first version had `macos-latest` in the matrix too. Ubuntu and Windows finished within a minute. The macOS jobs sat at **"Queued — Waiting to run this check"** long after that.

That's normal for macOS on GitHub Actions. Apple's licence only allows macOS on Apple hardware, so GitHub can't spin up macOS VMs on ordinary cloud servers the way it does for Linux and Windows. The pool is much smaller, and the free plan caps you at **5 concurrent macOS jobs** (out of 20 total). `macos-latest` runs on Apple Silicon, which is also what every iOS and Mac project is queueing for, so waits swing from seconds to many minutes depending on the time of day.

My first workflow made it worse. It triggered on both `push` and `pull_request` with no branch filter, so every commit on a PR branch ran the whole matrix **twice**: two macOS jobs waiting for a Mac instead of one. The fix is the `on:` block above. `push` only runs for `master`, and PR commits are covered by `pull_request`. The `concurrency` group cancels the previous run when a new commit lands, so stale jobs don't sit in the queue.

Then I dropped `macos-latest` from the matrix. The macOS code is still tested: the `osascript` and `pgrep` branches run on every job through the mocked tests, including the check that AppleScript is never called when Spotify isn't running. What CI doesn't do any more is run those commands on a real Mac. For a small hobby app, I'll take that over waiting on a Mac for every push.

One thing to know before cancelling runs from a script: cancelling a workflow run through the API needs the **Actions: Read and write** permission on a fine-grained token. Contents and Pull requests aren't enough.

Python is pinned to 3.10 because the project pins `Pillow==9.2.0`, which predates wheels for newer Pythons. On 3.11+ pip would try to build it from source.

## Wrap-up

None of these bugs was hard on its own. What they had in common was code assuming the outside world wouldn't change: a token that lives forever, an API response that keeps its fields, a lyrics service that returns errors when it means no, an OS that's always Windows. The fixes all come down to checking what you got back before you use it, and having a fallback for when it isn't what you expected.

On Linux, install `python3-tk`, plus `playerctl` if you want the playback buttons without Premium. On macOS, the first button press asks you to allow your terminal to control Spotify.
