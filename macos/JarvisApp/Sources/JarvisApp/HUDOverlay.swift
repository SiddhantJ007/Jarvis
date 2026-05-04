import SwiftUI
import AppKit

final class HUDOverlay {
    static let shared = HUDOverlay()
    private var panel: NSPanel?

    func show() {
        if panel == nil {
            let content = HUDView()
            let hosting = NSHostingView(rootView: content)
            hosting.frame = NSRect(x: 0, y: 0, width: 220, height: 140)

            let style: NSWindow.StyleMask = [.borderless, .nonactivatingPanel]
            let panel = NSPanel(contentRect: hosting.frame, styleMask: style, backing: .buffered, defer: false)
            panel.level = .floating
            panel.backgroundColor = .clear
            panel.isOpaque = false
            panel.hasShadow = false
            panel.ignoresMouseEvents = false
            panel.contentView = hosting
            panel.collectionBehavior = [.canJoinAllSpaces, .ignoresCycle]
            positionPanel(panel)
            panel.orderFrontRegardless()
            self.panel = panel
        } else {
            panel?.orderFrontRegardless()
        }
    }

    private func positionPanel(_ panel: NSPanel) {
        guard let screen = NSScreen.main else { return }
        let padding: CGFloat = 24
        let size = panel.frame.size
        let origin = CGPoint(
            x: screen.visibleFrame.maxX - size.width - padding,
            y: screen.visibleFrame.minY + padding
        )
        panel.setFrameOrigin(origin)
    }
}

private struct HUDView: View {
    @ObservedObject private var voice = VoiceSessionManager.shared
    @State private var pulse = false
    @State private var speakPulse = false

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            // Outer glow ring for speaking/listening
            Circle()
                .strokeBorder(
                    voice.isPlaybackActive ? Color.purple.opacity(0.6) : Color.blue.opacity(0.5),
                    lineWidth: voice.isRecording || voice.isPlaybackActive ? 12 : 6
                )
                .blur(radius: voice.isRecording || voice.isPlaybackActive ? 12 : 6)
                .opacity(voice.isRecording || voice.isPlaybackActive ? 0.8 : 0.3)
                .scaleEffect(voice.isPlaybackActive ? (speakPulse ? 1.08 : 0.95) : 1.0)
                .animation(.easeInOut(duration: 0.9).repeatForever(autoreverses: true), value: speakPulse)
                .frame(width: 110, height: 110)

            Circle()
                .fill(
                    RadialGradient(
                        colors: [Color.black.opacity(0.8), Color.black.opacity(0.5)],
                        center: .center,
                        startRadius: 4,
                        endRadius: 60
                    )
                )
                .frame(width: 82, height: 82)
                .overlay(
                    Circle()
                        .stroke(Color.white.opacity(0.08), lineWidth: 1)
                )
                .shadow(color: Color.blue.opacity(0.4), radius: voice.isRecording ? 18 : 8, x: 0, y: 0)
                .scaleEffect(voice.isRecording ? (pulse ? 1.08 : 0.95) : 1.0)
                .animation(.easeInOut(duration: 1.1).repeatForever(autoreverses: true), value: pulse)
                .onAppear { pulse.toggle(); speakPulse.toggle() }

            VStack(alignment: .trailing, spacing: 6) {
                Text(voice.isRecording ? "Listening…" : (voice.isPlaybackActive ? "Speaking…" : "Idle"))
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(.white.opacity(0.9))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .fill(Color.black.opacity(0.45))
                            .overlay(
                                RoundedRectangle(cornerRadius: 10, style: .continuous)
                                    .stroke(Color.white.opacity(0.08), lineWidth: 1)
                            )
                    )
            }
            .padding(.trailing, 10)
            .padding(.bottom, 10)
        }
        .frame(width: 220, height: 140, alignment: .bottomTrailing)
        .background(Color.clear)
    }
}
