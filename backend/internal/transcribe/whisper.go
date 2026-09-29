package transcribe

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"strings"
)

var ErrRunning = errors.New("running transcription tool")

type Whisper struct {
	FFmpegBin  string
	WhisperBin string
	ModelPath  string
	TempDir    string
}

func (w Whisper) Transcribe(ctx context.Context, audioPath string) (string, error) {
	f, err := os.CreateTemp(w.TempDir, "clip-*.wav")
	if err != nil {
		return "", fmt.Errorf("creating temp wav: %w", err)
	}
	wav := f.Name()
	defer os.Remove(wav)
	if err = f.Close(); err != nil {
		return "", fmt.Errorf("closing temp wav: %w", err)
	}

	ffmpeg := exec.CommandContext(
		ctx,
		w.FFmpegBin,
		"-y",
		"-i", audioPath,
		"-ar", "16000",
		"-ac", "1",
		"-c:a", "pcm_s16le",
		wav,
	)
	if _, err = run(ffmpeg); err != nil {
		return "", fmt.Errorf("%w: ffmpeg: %w", ErrRunning, err)
	}

	whisper := exec.CommandContext(ctx, w.WhisperBin, "-m", w.ModelPath, "-f", wav, "-l", "en", "-nt", "-np")
	out, err := run(whisper)
	if err != nil {
		return "", fmt.Errorf("%w: whisper: %w", ErrRunning, err)
	}
	return strings.Join(strings.Fields(out), " "), nil
}

func run(cmd *exec.Cmd) (string, error) {
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("%w: %s", err, strings.TrimSpace(stderr.String()))
	}
	return stdout.String(), nil
}
