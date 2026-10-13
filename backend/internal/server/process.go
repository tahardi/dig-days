package server

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"mime/multipart"
	"net/http"
	"os"
	"strings"

	"github.com/tahardi/dig-days/backend/internal/model"
	"github.com/tahardi/dig-days/backend/internal/transcribe"
)

const maxUploadBytes = 50 << 20

type processHandler struct {
	transcriber transcribe.Transcriber
	extractor   model.Extractor
	logger      *slog.Logger
}

func (h processHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxUploadBytes)
	reader, err := r.MultipartReader()
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "body must be multipart/form-data")
		return
	}

	audioPath, catalogJSON, err := readParts(reader)
	if audioPath != "" {
		defer os.Remove(audioPath)
	}
	if err != nil {
		h.writeReadError(w, err)
		return
	}
	if audioPath == "" {
		writeError(w, http.StatusBadRequest, "bad_request", "audio is required")
		return
	}
	if catalogJSON == nil {
		writeError(w, http.StatusBadRequest, "bad_request", "catalog is required")
		return
	}
	var catalog model.Catalog
	if err = json.Unmarshal(catalogJSON, &catalog); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "catalog must be valid JSON")
		return
	}

	transcript, err := h.transcriber.Transcribe(r.Context(), audioPath)
	if err != nil {
		h.logger.ErrorContext(r.Context(), "transcribing audio", "error", err)
		writeError(w, http.StatusBadGateway, "upstream_failed", "transcribing audio failed")
		return
	}
	if strings.TrimSpace(transcript) == "" {
		writeError(w, http.StatusUnprocessableEntity, "no_speech", "no speech found")
		return
	}

	draft, err := h.extractor.Extract(r.Context(), transcript, catalog)
	if err != nil {
		h.logger.ErrorContext(r.Context(), "extracting draft", "error", err)
		writeError(w, http.StatusBadGateway, "upstream_failed", "extracting draft failed")
		return
	}
	writeJSON(w, http.StatusOK, model.ProcessResponse{Transcript: transcript, Draft: draft})
}

func (h processHandler) writeReadError(w http.ResponseWriter, err error) {
	if _, ok := errors.AsType[*http.MaxBytesError](err); ok {
		writeError(w, http.StatusRequestEntityTooLarge, "payload_too_large", "request body is too large")
		return
	}
	h.logger.Error("reading upload", "error", err)
	writeError(w, http.StatusBadRequest, "bad_request", "body must be valid multipart/form-data")
}

func readParts(reader *multipart.Reader) (string, []byte, error) {
	var audioPath string
	var catalogJSON []byte
	for {
		part, err := reader.NextPart()
		if errors.Is(err, io.EOF) {
			return audioPath, catalogJSON, nil
		}
		if err != nil {
			return audioPath, catalogJSON, err
		}
		switch part.FormName() {
		case "audio":
			if audioPath, err = saveUpload(part); err != nil {
				return audioPath, catalogJSON, err
			}
		case "catalog":
			if catalogJSON, err = io.ReadAll(part); err != nil {
				return audioPath, catalogJSON, err
			}
		}
	}
}

func saveUpload(part io.Reader) (string, error) {
	file, err := os.CreateTemp("", "upload-*.m4a")
	if err != nil {
		return "", err
	}
	_, copyErr := io.Copy(file, part)
	closeErr := file.Close()
	return file.Name(), errors.Join(copyErr, closeErr)
}
