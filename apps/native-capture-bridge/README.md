# native-capture-bridge

Windows helper used by the local engine to capture input from microphones and audio interfaces.

Current capabilities:

- lists native input devices for both `wavein` and `wasapi`
- records to WAV while streaming PCM chunks back to the engine
- emits capture metadata with backend, device, sample rate and chunk count
- supports capture profiles `safe`, `balanced`, `low-latency`

Examples:

- `dotnet run --project apps/native-capture-bridge -- --list-devices`
- `dotnet run --project apps/native-capture-bridge -- --list-devices-json`
- `dotnet run --project apps/native-capture-bridge -- --output D:\\tmp\\capture.wav --duration-ms 4000 --capture-profile low-latency --backend wavein --device-number 1`
- `dotnet run --project apps/native-capture-bridge -- --output D:\\tmp\\capture.wav --duration-ms 4000 --capture-profile balanced --backend wasapi --device-id "{device-id}"`
