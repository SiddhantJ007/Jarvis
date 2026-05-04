import Foundation
import Combine
import AVFoundation

struct JarvisQueryRequest: Codable {
    let sessionId: String
    let text: String
    let source: String
}

struct JarvisQueryResponse: Codable {
    let mode: String
    let replyText: String
    let ttsAudioBase64: String?
}

@MainActor
final class JarvisClient: ObservableObject {
    static let shared = JarvisClient()

    @Published var messages: [ChatMessage] = []
    let sessionId: String = UUID().uuidString
    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()
    private let baseURL = URL(string: "http://127.0.0.1:3001")!
    private let audioPlayer = AudioPlayer.shared

    private init() {}

    func send(text: String, source: String = "text") {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        messages.append(ChatMessage(role: .user, text: trimmed))
        Task { await sendRequest(text: trimmed, source: source, appendUser: false) }
    }

    func handleVoiceQuery(text: String) {
        Task { @MainActor in
            self.messages.append(ChatMessage(role: .user, text: text))
        }
        Task { await sendRequest(text: text, source: "voice", appendUser: false) }
    }

    private func sendRequest(text: String, source: String, appendUser: Bool) async {
        if appendUser {
            await MainActor.run {
                self.messages.append(ChatMessage(role: .user, text: text))
            }
        }

        let requestBody = JarvisQueryRequest(sessionId: sessionId, text: text, source: source)
        var request = URLRequest(url: baseURL.appendingPathComponent("/v0/query"))
        request.httpMethod = "POST"
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")

        do {
            request.httpBody = try encoder.encode(requestBody)
        } catch {
            await MainActor.run { self.appendError("Encoding error: \(error.localizedDescription)") }
            return
        }

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse else {
                await MainActor.run { self.appendError("Invalid response") }
                return
            }
            guard (200...299).contains(http.statusCode) else {
                let body = String(data: data, encoding: .utf8) ?? ""
                await MainActor.run { self.appendError("HTTP \(http.statusCode): \(body)") }
                return
            }
            let jarvisResponse = try decoder.decode(JarvisQueryResponse.self, from: data)
            await MainActor.run {
                self.messages.append(ChatMessage(role: .assistant, text: jarvisResponse.replyText))
            }
            if let audioBase64 = jarvisResponse.ttsAudioBase64 {
                audioPlayer.play(base64: audioBase64)
            }
        } catch {
            await MainActor.run { self.appendError("Network error: \(error.localizedDescription)") }
        }
    }

    @MainActor
    private func appendError(_ message: String) {
        messages.append(ChatMessage(role: .assistant, text: "Error: \(message)"))
    }
}
