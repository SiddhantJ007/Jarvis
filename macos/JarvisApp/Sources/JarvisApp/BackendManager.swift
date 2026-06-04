import Foundation

final class BackendManager {
    static let shared = BackendManager()

    private let backendURL = URL(string: "http://127.0.0.1:3001")!
    private var process: Process?
    private var isStarting = false

    private init() {}

    func ensureRunning(completion: (() -> Void)? = nil) {
        checkHealth { [weak self] running in
            guard let self else { return }
            if running {
                DispatchQueue.main.async { completion?() }
                return
            }
            self.startBackend()
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
                completion?()
            }
        }
    }

    private func checkHealth(completion: @escaping (Bool) -> Void) {
        var request = URLRequest(url: backendURL)
        request.httpMethod = "GET"
        request.timeoutInterval = 1.5
        URLSession.shared.dataTask(with: request) { _, response, error in
            if error != nil {
                completion(false)
                return
            }
            completion(response != nil)
        }.resume()
    }

    private func startBackend() {
        guard !isStarting, process?.isRunning != true else { return }
        guard let root = findProjectRoot() else {
            print("[backend] Could not locate Jarvis project root. Start backend manually with `npm start`.")
            return
        }

        isStarting = true
        let proc = Process()
        proc.executableURL = URL(fileURLWithPath: "/usr/bin/env")
        proc.arguments = ["npm", "start"]
        proc.currentDirectoryURL = root

        let pipe = Pipe()
        proc.standardOutput = pipe
        proc.standardError = pipe
        pipe.fileHandleForReading.readabilityHandler = { handle in
            let data = handle.availableData
            guard !data.isEmpty, let text = String(data: data, encoding: .utf8) else { return }
            print("[backend] \(text.trimmingCharacters(in: .whitespacesAndNewlines))")
        }

        proc.terminationHandler = { [weak self] process in
            print("[backend] Backend exited with status \(process.terminationStatus)")
            self?.isStarting = false
            self?.process = nil
        }

        do {
            try proc.run()
            process = proc
            print("[backend] Starting Jarvis daemon from \(root.path)")
        } catch {
            isStarting = false
            print("[backend] Failed to start Jarvis daemon: \(error.localizedDescription)")
        }
    }

    private func findProjectRoot() -> URL? {
        let envRoot = ProcessInfo.processInfo.environment["JARVIS_PROJECT_ROOT"]
        let candidates = [
            envRoot.map(URL.init(fileURLWithPath:)),
            URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
                .appendingPathComponent("../..")
                .standardizedFileURL,
            URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
                .standardizedFileURL,
        ].compactMap { $0 }

        return candidates.first { candidate in
            FileManager.default.fileExists(atPath: candidate.appendingPathComponent("package.json").path)
        }
    }
}
