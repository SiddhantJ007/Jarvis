import Foundation
import AVFoundation
import AppKit
import Accelerate

final class VoiceSessionManager: NSObject, ObservableObject {
    static let shared = VoiceSessionManager()

    private let engine = AVAudioEngine()
    private var audioFile: AVAudioFile?
    private var recordingURL: URL?
    @Published var isRecording: Bool = false
    private var isContinuous: Bool = false
    private var suppressNextSend: Bool = false
    private var restartAfterPlayback: Bool = false
    @Published var isPlaybackActive: Bool = false
    private var pendingRearmAfterSTT: Bool = false
    private var hardMuted: Bool = false
    private var hasSpeech = false
    private var lastSpeechTime: TimeInterval = 0
    private var recordingStartTime: TimeInterval = 0
    private var lastBackendFailureTime: TimeInterval = 0
    private let silenceThreshold: Float = -55.0 // dBFS approximate (more tolerant before cutting off)
    private let silenceDuration: TimeInterval = 1.8 // wait a bit longer to avoid early cutoff
    private let maxUtteranceDuration: TimeInterval = 14.0 // safety cap so noise cannot hold recording forever
    private let responseDelay: TimeInterval = 0.5 // brief delay before re-arming to avoid self-trigger

    private override init() {
        super.init()
        NotificationCenter.default.addObserver(self, selector: #selector(handleAudioWillPlay), name: .jarvisAudioWillPlay, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(handleAudioDidFinish), name: .jarvisAudioDidFinish, object: nil)
    }

    func toggleRecording() {
        if isPlaybackActive {
            AudioPlayer.shared.stopPlayback()
            suppressNextSend = false
            restartAfterPlayback = false
            DispatchQueue.main.asyncAfter(deadline: .now() + responseDelay) { [weak self] in
                self?.startRecordingSession(continuous: true)
            }
            return
        }

        if isRecording && !isContinuous {
            stopRecordingAndSend()
        } else {
            startRecordingSession(continuous: true)
        }
    }

    func startContinuousListeningIfIdle() {
        guard !isRecording, !isPlaybackActive, !hardMuted else { return }
        startRecordingSession(continuous: true)
    }

    func stopListening() {
        isContinuous = false
        hardMuted = false
        suppressNextSend = false
        pendingRearmAfterSTT = false
        restartAfterPlayback = false
        stopRecording(discard: true)
    }

    func startRecordingSession(continuous: Bool = false) {
        isContinuous = continuous
        requestPermission { granted in
            guard granted else {
                self.showAlert(title: "Microphone Access Needed", message: "Enable microphone access for Jarvis to record your voice.")
                return
            }
            DispatchQueue.main.async {
                self.startRecorder()
            }
        }
    }

    private func startRecorder() {
        let input = engine.inputNode
        let format = input.inputFormat(forBus: 0)
        let tmp = FileManager.default.temporaryDirectory
        let url = tmp.appendingPathComponent("jarvis-recording-\(UUID().uuidString).wav")
        recordingURL = url

        do {
            audioFile = try AVAudioFile(forWriting: url, settings: format.settings)
        } catch {
            print("[voice] Failed to create audio file: \(error)")
            return
        }

        hasSpeech = false
        recordingStartTime = CACurrentMediaTime()
        lastSpeechTime = recordingStartTime

        input.removeTap(onBus: 0)
        input.installTap(onBus: 0, bufferSize: 2048, format: format) { [weak self] buffer, _ in
            guard let self, let file = self.audioFile else { return }
            do {
                try file.write(from: buffer)
            } catch {
                print("[voice] Failed to write buffer: \(error)")
            }

            let channelData = buffer.floatChannelData?[0]
            let frameLength = Int(buffer.frameLength)
            if let channelData = channelData, frameLength > 0 {
                var rms: Float = 0
                vDSP_rmsqv(channelData, 1, &rms, vDSP_Length(frameLength))
                let avgPower = 20 * log10(rms + Float.ulpOfOne)
                let now = CACurrentMediaTime()
                if self.hasSpeech && (now - self.recordingStartTime) > self.maxUtteranceDuration {
                    DispatchQueue.main.async {
                        self.stopRecordingAndSend()
                    }
                    return
                }
                if avgPower > silenceThreshold {
                    hasSpeech = true
                    lastSpeechTime = now
                } else if hasSpeech && (now - lastSpeechTime) > silenceDuration {
                    DispatchQueue.main.async {
                        self.stopRecordingAndSend()
                    }
                }
            }
        }

        do {
            try engine.start()
            isRecording = true
        } catch {
            print("[voice] Failed to start engine: \(error)")
            engine.stop()
            isRecording = false
        }
    }

    private func stopRecording(discard: Bool) {
        engine.inputNode.removeTap(onBus: 0)
        engine.stop()
        audioFile = nil
        let fileURL = recordingURL
        recordingURL = nil
        isRecording = false

        guard let fileURL else { return }
        guard discard == false else { return }
        do {
            let data = try Data(contentsOf: fileURL)
            Task { [weak self] in
                guard let self else { return }
                let dispatchedQuery = await self.sendAudioToSTT(data: data, mimeType: "audio/wav")
                if self.isContinuous && !dispatchedQuery {
                    if self.isPlaybackActive || self.hardMuted {
                        self.pendingRearmAfterSTT = true
                    } else {
                        let recentBackendFailure =
                            CACurrentMediaTime() - self.lastBackendFailureTime < 4.0
                        let delay = recentBackendFailure ? 3.0 : self.responseDelay
                        try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
                        DispatchQueue.main.async {
                            VoiceSessionManager.shared.startRecordingSession(continuous: true)
                        }
                    }
                }
            }
        } catch {
            print("[voice] Failed to read recorded audio: \(error)")
        }
    }

    func stopRecordingAndSend() {
        stopRecording(discard: false)
    }

    func resumeAfterSilentResponseIfNeeded() {
        guard isContinuous || pendingRearmAfterSTT else { return }
        pendingRearmAfterSTT = false
        hardMuted = false
        guard !isRecording, !isPlaybackActive else { return }
        DispatchQueue.main.asyncAfter(deadline: .now() + responseDelay) { [weak self] in
            self?.startRecordingSession(continuous: true)
        }
    }

    private func sendAudioToSTT(data: Data, mimeType: String) async -> Bool {
        guard let url = URL(string: "http://127.0.0.1:3001/v0/stt") else { return false }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 20
        request.setValue(mimeType, forHTTPHeaderField: "Content-Type")
        request.httpBody = data

        do {
            let (respData, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
                print("[voice] STT HTTP error")
                return false
            }
            let obj = try JSONSerialization.jsonObject(with: respData, options: []) as? [String: Any]
            if let text = obj?["text"] as? String {
                let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !trimmed.isEmpty else { return false }
                await MainActor.run {
                    print("[voice] Transcribed: \(trimmed)")
                    self.pendingRearmAfterSTT = true
                    JarvisClient.shared.handleVoiceQuery(text: trimmed)
                }
                return true
            }
        } catch {
            lastBackendFailureTime = CACurrentMediaTime()
            print("[voice] STT request failed: \(error)")
            BackendManager.shared.ensureRunning()
        }
        return false
    }

    private func requestPermission(completion: @escaping (Bool) -> Void) {
        AVCaptureDevice.requestAccess(for: .audio) { granted in completion(granted) }
    }

    private func showAlert(title: String, message: String) {
        DispatchQueue.main.async {
            let alert = NSAlert()
            alert.messageText = title
            alert.informativeText = message
            alert.runModal()
        }
    }

    @objc private func handleAudioWillPlay() {
        isPlaybackActive = true
        hardMuted = true
        restartAfterPlayback = isContinuous
        if isRecording {
            suppressNextSend = true
            stopRecording(discard: true)
        }
    }

    @objc private func handleAudioDidFinish() {
        isPlaybackActive = false
        if restartAfterPlayback {
            restartAfterPlayback = false
            DispatchQueue.main.asyncAfter(deadline: .now() + responseDelay) { [weak self] in
                guard let self else { return }
                self.pendingRearmAfterSTT = false
                self.hardMuted = false
                self.startRecordingSession(continuous: true)
            }
        } else if pendingRearmAfterSTT {
            pendingRearmAfterSTT = false
            DispatchQueue.main.asyncAfter(deadline: .now() + responseDelay) { [weak self] in
                guard let self else { return }
                self.hardMuted = false
                self.startRecordingSession(continuous: true)
            }
        } else {
            hardMuted = false
        }
    }
}
