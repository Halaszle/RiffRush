using NAudio.CoreAudioApi;
using NAudio.Wave;
using System.Text.Json;

internal sealed class CaptureOptions
{
    public bool ListDevices { get; init; }
    public bool ListDevicesJson { get; init; }
    public bool PreflightJson { get; init; }
    public bool StreamJson { get; init; }
    public string? OutputPath { get; init; }
    public int DurationMs { get; init; } = 4000;
    public int SampleRate { get; init; } = 48000;
    public string Backend { get; init; } = "wavein";
    public string CaptureProfile { get; init; } = "balanced";
    public int? BufferMillisecondsOverride { get; init; }
    public int? NumberOfBuffersOverride { get; init; }
    public bool? UseEventSyncOverride { get; init; }
    public string? DeviceId { get; init; }
    public int DeviceNumber { get; init; }
}

internal sealed class NativeInputDeviceDescriptor
{
    public required string Backend { get; init; }
    public required string Name { get; init; }
    public required int DeviceNumber { get; init; }
    public string? DeviceId { get; init; }
    public bool IsDefault { get; init; }
}

internal sealed class CaptureCompletionPayload
{
    public required string type { get; init; }
    public required string outputPath { get; init; }
    public required CaptureSummary capture { get; init; }
}

internal sealed class CaptureSummary
{
    public required string source { get; init; }
    public required string profile { get; init; }
    public required string backend { get; init; }
    public string? deviceId { get; init; }
    public required string deviceName { get; init; }
    public required int deviceNumber { get; init; }
    public required int sampleRate { get; init; }
    public required int chunkCount { get; init; }
    public required int durationMs { get; init; }
    public required int bufferMs { get; init; }
    public required int numberOfBuffers { get; init; }
    public required bool useEventSync { get; init; }
}

internal sealed class CaptureProfileSettings
{
    public required int BufferMilliseconds { get; init; }
    public required int NumberOfBuffers { get; init; }
    public required bool UseEventSync { get; init; }
}

internal sealed class PreflightPayload
{
    public required bool ok { get; init; }
    public required PreflightDevice selectedDevice { get; init; }
    public required PreflightResolved resolved { get; init; }
}

internal sealed class PreflightDevice
{
    public required string backend { get; init; }
    public string? deviceId { get; init; }
    public required int deviceNumber { get; init; }
    public required string name { get; init; }
}

internal sealed class PreflightResolved
{
    public required string captureProfile { get; init; }
    public required string backend { get; init; }
    public required int bufferMs { get; init; }
    public required int numberOfBuffers { get; init; }
    public required bool useEventSync { get; init; }
    public required int sampleRate { get; init; }
    public required int captureDurationMs { get; init; }
}

internal static class Program
{
    public static async Task<int> Main(string[] args)
    {
        try
        {
            var options = ParseArguments(args);

            if (options.ListDevicesJson)
            {
                ListDevicesJson();
                return 0;
            }

            if (options.PreflightJson)
            {
                RunPreflightJson(options);
                return 0;
            }

            if (options.ListDevices)
            {
                ListDevices();
                return 0;
            }

            if (string.IsNullOrWhiteSpace(options.OutputPath))
            {
                Console.Error.WriteLine("Missing required --output argument.");
                return 1;
            }

            await RecordAsync(options);
            if (!options.StreamJson)
            {
                Console.WriteLine(options.OutputPath);
            }
            return 0;
        }
        catch (Exception exception)
        {
            Console.Error.WriteLine(exception.Message);
            return 1;
        }
    }

    private static CaptureOptions ParseArguments(string[] args)
    {
        var outputPath = default(string);
        var listDevices = false;
        var listDevicesJson = false;
        var preflightJson = false;
        var streamJson = false;
        var durationMs = 4000;
        var sampleRate = 48000;
        var backend = "wavein";
        var captureProfile = "balanced";
        var bufferMillisecondsOverride = default(int?);
        var numberOfBuffersOverride = default(int?);
        var useEventSyncOverride = default(bool?);
        var deviceId = default(string);
        var deviceNumber = 0;

        for (var index = 0; index < args.Length; index += 1)
        {
            switch (args[index])
            {
                case "--list-devices":
                    listDevices = true;
                    break;
                case "--list-devices-json":
                    listDevicesJson = true;
                    break;
                case "--preflight-json":
                    preflightJson = true;
                    break;
                case "--stream-json":
                    streamJson = true;
                    break;
                case "--output":
                    outputPath = RequireValue(args, ref index, "--output");
                    break;
                case "--duration-ms":
                    durationMs = int.Parse(RequireValue(args, ref index, "--duration-ms"));
                    break;
                case "--sample-rate":
                    sampleRate = int.Parse(RequireValue(args, ref index, "--sample-rate"));
                    break;
                case "--backend":
                    backend = RequireValue(args, ref index, "--backend").ToLowerInvariant();
                    break;
                case "--capture-profile":
                    captureProfile = RequireValue(args, ref index, "--capture-profile").ToLowerInvariant();
                    break;
                case "--buffer-ms":
                    bufferMillisecondsOverride = int.Parse(RequireValue(args, ref index, "--buffer-ms"));
                    break;
                case "--number-of-buffers":
                    numberOfBuffersOverride = int.Parse(RequireValue(args, ref index, "--number-of-buffers"));
                    break;
                case "--use-event-sync":
                    useEventSyncOverride = bool.Parse(RequireValue(args, ref index, "--use-event-sync"));
                    break;
                case "--device-id":
                    deviceId = RequireValue(args, ref index, "--device-id");
                    break;
                case "--device-number":
                    deviceNumber = int.Parse(RequireValue(args, ref index, "--device-number"));
                    break;
                default:
                    throw new InvalidOperationException($"Unsupported argument: {args[index]}");
            }
        }

        if (backend is not ("wavein" or "wasapi"))
        {
            throw new InvalidOperationException("Argument --backend must be wavein or wasapi.");
        }

        if (captureProfile is not ("safe" or "balanced" or "low-latency"))
        {
            throw new InvalidOperationException("Argument --capture-profile must be safe, balanced or low-latency.");
        }

        return new CaptureOptions
        {
            ListDevices = listDevices,
            ListDevicesJson = listDevicesJson,
            PreflightJson = preflightJson,
            StreamJson = streamJson,
            OutputPath = outputPath,
            DurationMs = durationMs,
            SampleRate = sampleRate,
            Backend = backend,
            CaptureProfile = captureProfile,
            BufferMillisecondsOverride = bufferMillisecondsOverride,
            NumberOfBuffersOverride = numberOfBuffersOverride,
            UseEventSyncOverride = useEventSyncOverride,
            DeviceId = deviceId,
            DeviceNumber = deviceNumber
        };
    }

    private static string RequireValue(string[] args, ref int index, string name)
    {
        if (index + 1 >= args.Length)
        {
            throw new InvalidOperationException($"Argument {name} requires a value.");
        }

        index += 1;
        return args[index];
    }

    private static void ListDevices()
    {
        foreach (var device in GetDevices())
        {
            var defaultSuffix = device.IsDefault ? " [default]" : string.Empty;
            Console.WriteLine($"{device.Backend}/{device.DeviceNumber}: {device.Name}{defaultSuffix}");
        }
    }

    private static void ListDevicesJson()
    {
        var payload = GetDevices()
            .Select(device => new
            {
                backend = device.Backend,
                deviceId = device.DeviceId,
                deviceNumber = device.DeviceNumber,
                name = device.Name,
                isDefault = device.IsDefault
            })
            .ToArray();

        Console.WriteLine(JsonSerializer.Serialize(payload));
    }

    private static void RunPreflightJson(CaptureOptions options)
    {
        var payload = options.Backend switch
        {
            "wavein" => BuildWaveInPreflightPayload(options),
            "wasapi" => BuildWasapiPreflightPayload(options),
            _ => throw new InvalidOperationException($"Unsupported backend {options.Backend}.")
        };

        Console.WriteLine(JsonSerializer.Serialize(payload));
    }

    private static IReadOnlyList<NativeInputDeviceDescriptor> GetDevices()
    {
        var devices = new List<NativeInputDeviceDescriptor>();

        for (var index = 0; index < WaveInEvent.DeviceCount; index += 1)
        {
            var capabilities = WaveInEvent.GetCapabilities(index);
            devices.Add(new NativeInputDeviceDescriptor
            {
                Backend = "wavein",
                DeviceId = $"wavein:{index}",
                DeviceNumber = index,
                Name = capabilities.ProductName,
                IsDefault = index == 0
            });
        }

        using var enumerator = new MMDeviceEnumerator();
        var defaultEndpointId = default(string);

        try
        {
            defaultEndpointId = enumerator.GetDefaultAudioEndpoint(DataFlow.Capture, Role.Console).ID;
        }
        catch
        {
            defaultEndpointId = null;
        }

        var captureDevices = enumerator.EnumerateAudioEndPoints(DataFlow.Capture, DeviceState.Active);

        for (var index = 0; index < captureDevices.Count; index += 1)
        {
            var device = captureDevices[index];
            devices.Add(new NativeInputDeviceDescriptor
            {
                Backend = "wasapi",
                DeviceId = device.ID,
                DeviceNumber = index,
                Name = device.FriendlyName,
                IsDefault = string.Equals(device.ID, defaultEndpointId, StringComparison.OrdinalIgnoreCase)
            });
        }

        return devices;
    }

    private static Task RecordAsync(CaptureOptions options)
    {
        return options.Backend switch
        {
            "wavein" => RecordWaveInAsync(options),
            "wasapi" => RecordWasapiAsync(options),
            _ => throw new InvalidOperationException($"Unsupported backend {options.Backend}.")
        };
    }

    private static PreflightPayload BuildWaveInPreflightPayload(CaptureOptions options)
    {
        var profileSettings = ResolveCaptureProfile(options);
        var deviceName = GetWaveInDeviceName(options.DeviceNumber);

        return new PreflightPayload
        {
            ok = true,
            selectedDevice = new PreflightDevice
            {
                backend = "wavein",
                deviceId = options.DeviceId ?? $"wavein:{options.DeviceNumber}",
                deviceNumber = options.DeviceNumber,
                name = deviceName
            },
            resolved = new PreflightResolved
            {
                captureProfile = options.CaptureProfile,
                backend = "wavein",
                bufferMs = profileSettings.BufferMilliseconds,
                numberOfBuffers = profileSettings.NumberOfBuffers,
                useEventSync = profileSettings.UseEventSync,
                sampleRate = options.SampleRate,
                captureDurationMs = options.DurationMs
            }
        };
    }

    private static PreflightPayload BuildWasapiPreflightPayload(CaptureOptions options)
    {
        var profileSettings = ResolveCaptureProfile(options);
        using var enumerator = new MMDeviceEnumerator();
        using var device = ResolveWasapiDevice(enumerator, options);
        using var capture = new WasapiCapture(device, profileSettings.UseEventSync, profileSettings.BufferMilliseconds);

        return new PreflightPayload
        {
            ok = true,
            selectedDevice = new PreflightDevice
            {
                backend = "wasapi",
                deviceId = device.ID,
                deviceNumber = options.DeviceNumber,
                name = device.FriendlyName
            },
            resolved = new PreflightResolved
            {
                captureProfile = options.CaptureProfile,
                backend = "wasapi",
                bufferMs = profileSettings.BufferMilliseconds,
                numberOfBuffers = profileSettings.NumberOfBuffers,
                useEventSync = profileSettings.UseEventSync,
                sampleRate = capture.WaveFormat.SampleRate,
                captureDurationMs = options.DurationMs
            }
        };
    }

    private static async Task RecordWaveInAsync(CaptureOptions options)
    {
        var outputDirectory = Path.GetDirectoryName(options.OutputPath!);
        var outputLock = new object();
        var chunkCount = 0;
        var profileSettings = ResolveCaptureProfile(options);

        if (!string.IsNullOrWhiteSpace(outputDirectory))
        {
            Directory.CreateDirectory(outputDirectory);
        }

        using var waveIn = new WaveInEvent
        {
            DeviceNumber = options.DeviceNumber,
            WaveFormat = new WaveFormat(options.SampleRate, 16, 1),
            BufferMilliseconds = profileSettings.BufferMilliseconds,
            NumberOfBuffers = profileSettings.NumberOfBuffers
        };

        using var writer = new WaveFileWriter(options.OutputPath!, waveIn.WaveFormat);
        var completionSource = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);

        waveIn.DataAvailable += (_, eventArgs) =>
        {
            var chunk = CreateMonoPcm16Chunk(eventArgs.Buffer, eventArgs.BytesRecorded, waveIn.WaveFormat);
            writer.Write(chunk, 0, chunk.Length);
            writer.Flush();
            chunkCount += 1;

            EmitChunkJson(options, outputLock, waveIn.WaveFormat.SampleRate, chunk);
        };

        waveIn.RecordingStopped += (_, eventArgs) =>
        {
            if (eventArgs.Exception is not null)
            {
                completionSource.TrySetException(eventArgs.Exception);
                return;
            }

            completionSource.TrySetResult();
        };

        waveIn.StartRecording();
        await Task.Delay(options.DurationMs);
        waveIn.StopRecording();
        await completionSource.Task;

        EmitCompletedJson(
            options,
            outputLock,
            BuildCaptureSummary(
                options,
                GetWaveInDeviceName(options.DeviceNumber),
                waveIn.WaveFormat.SampleRate,
                chunkCount,
                profileSettings.BufferMilliseconds));
    }

    private static async Task RecordWasapiAsync(CaptureOptions options)
    {
        var outputDirectory = Path.GetDirectoryName(options.OutputPath!);
        var outputLock = new object();
        var chunkCount = 0;
        var profileSettings = ResolveCaptureProfile(options);

        if (!string.IsNullOrWhiteSpace(outputDirectory))
        {
            Directory.CreateDirectory(outputDirectory);
        }

        using var enumerator = new MMDeviceEnumerator();
        using var device = ResolveWasapiDevice(enumerator, options);
        using var capture = new WasapiCapture(device, profileSettings.UseEventSync, profileSettings.BufferMilliseconds);
        var outputFormat = new WaveFormat(capture.WaveFormat.SampleRate, 16, 1);
        using var writer = new WaveFileWriter(options.OutputPath!, outputFormat);
        var completionSource = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);

        capture.DataAvailable += (_, eventArgs) =>
        {
            var chunk = CreateMonoPcm16Chunk(eventArgs.Buffer, eventArgs.BytesRecorded, capture.WaveFormat);
            writer.Write(chunk, 0, chunk.Length);
            writer.Flush();
            chunkCount += 1;

            EmitChunkJson(options, outputLock, outputFormat.SampleRate, chunk);
        };

        capture.RecordingStopped += (_, eventArgs) =>
        {
            if (eventArgs.Exception is not null)
            {
                completionSource.TrySetException(eventArgs.Exception);
                return;
            }

            completionSource.TrySetResult();
        };

        capture.StartRecording();
        await Task.Delay(options.DurationMs);
        capture.StopRecording();
        await completionSource.Task;

        EmitCompletedJson(
            options,
            outputLock,
            BuildCaptureSummary(
                options,
                device.FriendlyName,
                outputFormat.SampleRate,
                chunkCount,
                profileSettings.BufferMilliseconds));
    }

    private static MMDevice ResolveWasapiDevice(MMDeviceEnumerator enumerator, CaptureOptions options)
    {
        if (!string.IsNullOrWhiteSpace(options.DeviceId))
        {
            return enumerator.GetDevice(options.DeviceId);
        }

        var captureDevices = enumerator.EnumerateAudioEndPoints(DataFlow.Capture, DeviceState.Active);

        if (options.DeviceNumber < 0 || options.DeviceNumber >= captureDevices.Count)
        {
            throw new InvalidOperationException($"WASAPI device {options.DeviceNumber} is not available.");
        }

        return captureDevices[options.DeviceNumber];
    }

    private static void EmitChunkJson(CaptureOptions options, object outputLock, int sampleRate, byte[] chunk)
    {
        if (!options.StreamJson)
        {
            return;
        }

        var payload = JsonSerializer.Serialize(new
        {
            type = "chunk",
            sampleRate,
            chunkBase64 = Convert.ToBase64String(chunk)
        });

        lock (outputLock)
        {
            Console.Out.WriteLine(payload);
            Console.Out.Flush();
        }
    }

    private static void EmitCompletedJson(CaptureOptions options, object outputLock, CaptureSummary captureSummary)
    {
        if (!options.StreamJson)
        {
            return;
        }

        var payload = JsonSerializer.Serialize(new CaptureCompletionPayload
        {
            type = "completed",
            outputPath = options.OutputPath!,
            capture = captureSummary
        });

        lock (outputLock)
        {
            Console.Out.WriteLine(payload);
            Console.Out.Flush();
        }
    }

    private static CaptureSummary BuildCaptureSummary(
        CaptureOptions options,
        string deviceName,
        int sampleRate,
        int chunkCount,
        int bufferMs)
    {
        var profileSettings = ResolveCaptureProfile(options);

        return new CaptureSummary
        {
            source = "native-capture",
            profile = options.CaptureProfile,
            backend = options.Backend,
            deviceId = options.DeviceId ?? $"{options.Backend}:{options.DeviceNumber}",
            deviceName = deviceName,
            deviceNumber = options.DeviceNumber,
            sampleRate = sampleRate,
            chunkCount = chunkCount,
            durationMs = options.DurationMs,
            bufferMs = bufferMs,
            numberOfBuffers = profileSettings.NumberOfBuffers,
            useEventSync = profileSettings.UseEventSync
        };
    }

    private static CaptureProfileSettings ResolveCaptureProfile(CaptureOptions options)
    {
        var defaults = options.CaptureProfile switch
        {
            "safe" => new CaptureProfileSettings
            {
                BufferMilliseconds = 120,
                NumberOfBuffers = 4,
                UseEventSync = false
            },
            "low-latency" => new CaptureProfileSettings
            {
                BufferMilliseconds = 25,
                NumberOfBuffers = 2,
                UseEventSync = true
            },
            _ => new CaptureProfileSettings
            {
                BufferMilliseconds = 60,
                NumberOfBuffers = 3,
                UseEventSync = true
            }
        };

        return new CaptureProfileSettings
        {
            BufferMilliseconds = options.BufferMillisecondsOverride ?? defaults.BufferMilliseconds,
            NumberOfBuffers = options.NumberOfBuffersOverride ?? defaults.NumberOfBuffers,
            UseEventSync = options.UseEventSyncOverride ?? defaults.UseEventSync
        };
    }

    private static string GetWaveInDeviceName(int deviceNumber)
    {
        if (deviceNumber < 0 || deviceNumber >= WaveInEvent.DeviceCount)
        {
            throw new InvalidOperationException($"WaveIn device {deviceNumber} is not available.");
        }

        return WaveInEvent.GetCapabilities(deviceNumber).ProductName;
    }

    private static byte[] CreateMonoPcm16Chunk(byte[] buffer, int bytesRecorded, WaveFormat waveFormat)
    {
        if (bytesRecorded <= 0)
        {
            return Array.Empty<byte>();
        }

        if (waveFormat.BitsPerSample == 16 && waveFormat.Channels == 1 && waveFormat.Encoding == WaveFormatEncoding.Pcm)
        {
            var passthrough = new byte[bytesRecorded];
            Buffer.BlockCopy(buffer, 0, passthrough, 0, bytesRecorded);
            return passthrough;
        }

        var blockAlign = waveFormat.BlockAlign;

        if (blockAlign <= 0)
        {
            throw new InvalidOperationException("Audio format block alignment must be positive.");
        }

        var frameCount = bytesRecorded / blockAlign;
        var output = new byte[frameCount * 2];

        for (var frameIndex = 0; frameIndex < frameCount; frameIndex += 1)
        {
            var frameOffset = frameIndex * blockAlign;
            double mixedSample = 0;

            for (var channelIndex = 0; channelIndex < waveFormat.Channels; channelIndex += 1)
            {
                mixedSample += ReadNormalizedSample(buffer, frameOffset, channelIndex, waveFormat);
            }

            mixedSample /= waveFormat.Channels;
            mixedSample = Math.Clamp(mixedSample, -1d, 1d);
            var pcmValue = (short)Math.Round(mixedSample * short.MaxValue);
            var outputOffset = frameIndex * 2;
            output[outputOffset] = (byte)(pcmValue & 0xFF);
            output[outputOffset + 1] = (byte)((pcmValue >> 8) & 0xFF);
        }

        return output;
    }

    private static double ReadNormalizedSample(byte[] buffer, int frameOffset, int channelIndex, WaveFormat waveFormat)
    {
        var bytesPerChannelSample = waveFormat.BitsPerSample / 8;
        var sampleOffset = frameOffset + (channelIndex * bytesPerChannelSample);

        if (sampleOffset + bytesPerChannelSample > buffer.Length)
        {
            return 0;
        }

        return waveFormat.Encoding switch
        {
            WaveFormatEncoding.Pcm => ReadNormalizedPcmSample(buffer, sampleOffset, waveFormat.BitsPerSample),
            WaveFormatEncoding.IeeeFloat => ReadNormalizedFloatSample(buffer, sampleOffset, waveFormat.BitsPerSample),
            WaveFormatEncoding.Extensible => ReadNormalizedExtensibleSample(buffer, sampleOffset, waveFormat.BitsPerSample),
            _ => throw new InvalidOperationException(
                $"Unsupported audio encoding {waveFormat.Encoding} with {waveFormat.BitsPerSample} bits per sample.")
        };
    }

    private static double ReadNormalizedPcmSample(byte[] buffer, int sampleOffset, int bitsPerSample)
    {
        return bitsPerSample switch
        {
            16 => BitConverter.ToInt16(buffer, sampleOffset) / 32768d,
            24 => ReadInt24(buffer, sampleOffset) / 8388608d,
            32 => BitConverter.ToInt32(buffer, sampleOffset) / 2147483648d,
            _ => throw new InvalidOperationException($"Unsupported PCM bit depth {bitsPerSample}.")
        };
    }

    private static double ReadNormalizedFloatSample(byte[] buffer, int sampleOffset, int bitsPerSample)
    {
        return bitsPerSample switch
        {
            32 => BitConverter.ToSingle(buffer, sampleOffset),
            _ => throw new InvalidOperationException($"Unsupported float bit depth {bitsPerSample}.")
        };
    }

    private static double ReadNormalizedExtensibleSample(byte[] buffer, int sampleOffset, int bitsPerSample)
    {
        return bitsPerSample switch
        {
            16 => ReadNormalizedPcmSample(buffer, sampleOffset, bitsPerSample),
            24 => ReadNormalizedPcmSample(buffer, sampleOffset, bitsPerSample),
            32 => ReadNormalizedFloatSample(buffer, sampleOffset, bitsPerSample),
            _ => throw new InvalidOperationException($"Unsupported extensible bit depth {bitsPerSample}.")
        };
    }

    private static int ReadInt24(byte[] buffer, int sampleOffset)
    {
        var value = buffer[sampleOffset]
            | (buffer[sampleOffset + 1] << 8)
            | (buffer[sampleOffset + 2] << 16);

        if ((value & 0x800000) != 0)
        {
            value |= unchecked((int)0xFF000000);
        }

        return value;
    }
}
