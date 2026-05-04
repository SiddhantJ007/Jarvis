import Foundation
import AVFoundation

final class AudioPlayer: NSObject {
    static let shared = AudioPlayer()
    private var player: AVAudioPlayer?
    private var didPlayOnce = false

    private override init() {}

    func stopPlayback() {
        DispatchQueue.main.async { [weak self] in
            self?.player?.stop()
            self?.player = nil
            NotificationCenter.default.post(name: .jarvisAudioDidFinish, object: nil)
        }
    }

    func play(base64: String) {
        guard let data = Data(base64Encoded: base64) else { return }
        DispatchQueue.main.async { [weak self] in
            NotificationCenter.default.post(name: .jarvisAudioWillPlay, object: nil)
            self?.player?.stop()
            self?.player = try? AVAudioPlayer(data: data)
            self?.player?.delegate = self
            self?.player?.prepareToPlay()
            self?.player?.play()
            self?.didPlayOnce = true
        }
    }
}

extension AudioPlayer: AVAudioPlayerDelegate {
    func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        NotificationCenter.default.post(name: .jarvisAudioDidFinish, object: nil)
    }
}

extension Notification.Name {
    static let jarvisAudioWillPlay = Notification.Name("jarvisAudioWillPlay")
    static let jarvisAudioDidFinish = Notification.Name("jarvisAudioDidFinish")
}
