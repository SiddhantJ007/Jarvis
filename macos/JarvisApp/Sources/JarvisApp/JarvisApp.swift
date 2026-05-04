import SwiftUI
import AppKit
import Carbon

private var hotKeyRef: EventHotKeyRef?
private var hotKeyHandlerRef: EventHandlerRef?
private var muteHotKeyRef: EventHotKeyRef?

private func hotKeyHandler(proxy: EventHandlerCallRef?, event: EventRef?, userData: UnsafeMutableRawPointer?) -> OSStatus {
    var hotKeyID = EventHotKeyID()
    GetEventParameter(event, EventParamName(kEventParamDirectObject), EventParamType(typeEventHotKeyID), nil, MemoryLayout<EventHotKeyID>.size, nil, &hotKeyID)

    if hotKeyID.id == 1 {
        VoiceSessionManager.shared.toggleRecording()
    } else if hotKeyID.id == 2 {
        VoiceSessionManager.shared.stopListening()
    }
    return noErr
}

@main
struct JarvisApp: App {
    init() {
        NSApplication.shared.setActivationPolicy(.regular)
        NSApplication.shared.activate(ignoringOtherApps: true)
        registerHotkey()
        HUDOverlay.shared.show()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .onAppear {
                    NSApplication.shared.activate(ignoringOtherApps: true)
                }
        }
        .commands {
            CommandGroup(after: .appVisibility) {
                Button("Open Debug Chat Window") {
                    NSApplication.shared.activate(ignoringOtherApps: true)
                }
                .keyboardShortcut("0", modifiers: [.command, .shift])
            }
        }
    }

    private func registerHotkey() {
        let hotKeyID = EventHotKeyID(signature: OSType(0x4A565331), id: 1)
        var eventType = EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyPressed))
        let status = InstallEventHandler(GetApplicationEventTarget(), hotKeyHandler, 1, &eventType, nil, &hotKeyHandlerRef)
        guard status == noErr else {
            print("[hotkey] Failed to install handler")
            return
        }
        RegisterEventHotKey(UInt32(kVK_ANSI_J), UInt32(cmdKey | shiftKey), hotKeyID, GetApplicationEventTarget(), 0, &hotKeyRef)

        let muteHotKeyID = EventHotKeyID(signature: OSType(0x4A565332), id: 2)
        RegisterEventHotKey(UInt32(kVK_ANSI_K), UInt32(cmdKey | shiftKey), muteHotKeyID, GetApplicationEventTarget(), 0, &muteHotKeyRef)
    }
}
