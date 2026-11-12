using System.Management;

namespace Costalog.Agent.Service;

public sealed class PhysicalDiskInfo
{
    public string MediaType { get; init; } = "fixed";
    public string Health { get; init; } = "unknown";
    public double? TemperatureC { get; init; }
    public double? WearPercent { get; init; }
    public string Model { get; init; } = "";
}

// Saúde física dos discos pela API de armazenamento do Windows (equivalente ao
// Get-PhysicalDisk / Get-StorageReliabilityCounter), associada às letras de unidade.
public static class StorageHealth
{
    const string Scope = @"\\.\root\Microsoft\Windows\Storage";

    public static Dictionary<string, PhysicalDiskInfo> ReadByDriveLetter()
    {
        var result = new Dictionary<string, PhysicalDiskInfo>(StringComparer.OrdinalIgnoreCase);

        try
        {
            var disks = Query("SELECT DeviceId, FriendlyName, MediaType, HealthStatus FROM MSFT_PhysicalDisk");
            var counters = Query("SELECT DeviceId, Temperature, Wear FROM MSFT_StorageReliabilityCounter");
            var partitions = Query("SELECT DiskNumber, DriveLetter FROM MSFT_Partition");

            var byDisk = new Dictionary<string, PhysicalDiskInfo>(StringComparer.OrdinalIgnoreCase);

            foreach (var disk in disks)
            {
                var id = disk.GetValueOrDefault("DeviceId")?.ToString() ?? "";

                if (id.Length == 0)
                    continue;

                var media = ToInt(disk.GetValueOrDefault("MediaType")) switch
                {
                    3 => "HDD",
                    4 => "SSD",
                    5 => "SCM",
                    _ => "fixed"
                };

                var health = ToInt(disk.GetValueOrDefault("HealthStatus")) switch
                {
                    0 => "healthy",
                    1 => "warning",
                    2 => "unhealthy",
                    _ => "unknown"
                };

                var counter = counters.FirstOrDefault(x =>
                    string.Equals(x.GetValueOrDefault("DeviceId")?.ToString(), id, StringComparison.OrdinalIgnoreCase));

                var temperature = ToInt(counter?.GetValueOrDefault("Temperature"));
                var wear = ToInt(counter?.GetValueOrDefault("Wear"));

                byDisk[id] = new PhysicalDiskInfo
                {
                    MediaType = media,
                    Health = health,
                    TemperatureC = temperature is > 0 and < 120 ? temperature : null,
                    WearPercent = media == "SSD" && wear is >= 0 and <= 100 && counter is not null ? wear : null,
                    Model = (disk.GetValueOrDefault("FriendlyName")?.ToString() ?? "").Trim()
                };
            }

            foreach (var partition in partitions)
            {
                var letterValue = partition.GetValueOrDefault("DriveLetter");

                if (letterValue is null)
                    continue;

                var letter = Convert.ToChar(letterValue);

                if (!char.IsLetter(letter))
                    continue;

                var diskNumber = partition.GetValueOrDefault("DiskNumber")?.ToString() ?? "";

                if (byDisk.TryGetValue(diskNumber, out var info))
                    result[letter.ToString()] = info;
            }
        }
        catch
        {
        }

        return result;
    }

    static int? ToInt(object? value)
    {
        try
        {
            return value is null ? null : Convert.ToInt32(value);
        }
        catch
        {
            return null;
        }
    }

    static List<Dictionary<string, object?>> Query(string query)
    {
        var list = new List<Dictionary<string, object?>>();

        try
        {
            using var searcher = new ManagementObjectSearcher(Scope, query);
            using var results = searcher.Get();

            foreach (ManagementObject item in results)
            {
                using (item)
                {
                    var values = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);

                    foreach (PropertyData property in item.Properties)
                        values[property.Name] = property.Value;

                    list.Add(values);
                }
            }
        }
        catch
        {
        }

        return list;
    }
}
