using DrawingPortal.Api.Common;
using DrawingPortal.Api.Data;
using DrawingPortal.Api.Domain;
using DrawingPortal.Api.Dtos;
using Microsoft.EntityFrameworkCore;

namespace DrawingPortal.Api.Services;

public interface IMasterDataService
{
    Task<List<NamedItemDto>> ListNamedAsync(string kind, CancellationToken ct);
    Task<NamedItemDto> CreateNamedAsync(string kind, SaveNamedDto dto, CancellationToken ct);
    Task<NamedItemDto> UpdateNamedAsync(string kind, string id, SaveNamedDto dto, CancellationToken ct);
    Task DeleteNamedAsync(string kind, string id, CancellationToken ct);
    Task<List<ModelDto>> ListModelsAsync(CancellationToken ct);
    Task<ModelDto> SaveModelAsync(string? id, SaveModelDto dto, CancellationToken ct);
    Task DeleteModelAsync(string id, CancellationToken ct);
    Task<List<VoltageDto>> ListVoltagesAsync(CancellationToken ct);
    Task<VoltageDto> SaveVoltageAsync(string? id, SaveVoltageDto dto, CancellationToken ct);
    Task DeleteVoltageAsync(string id, CancellationToken ct);
    Task<List<AhDto>> ListAhAsync(CancellationToken ct);
    Task<AhDto> SaveAhAsync(string? id, SaveAhDto dto, CancellationToken ct);
    Task DeleteAhAsync(string id, CancellationToken ct);
}

public sealed class MasterDataService(AppDbContext db, IAuditService audit, ICacheVersion version) : IMasterDataService
{
    private static NamedItemDto ToDto(NamedMaster x) => new(x.Id, x.Name, x.SortOrder, x.IsActive);
    private static ApiException UnknownKind() => ApiException.NotFound("Unknown master data type.");

    private async Task Commit(string action, string type, string id, string summary, CancellationToken ct)
    {
        audit.Add(action, type, id, summary);
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException) { throw ApiException.Conflict("A record with the same value already exists."); }
        version.Bump();
    }

    // ---------- Named masters (category, type, make, connector) ----------
    public Task<List<NamedItemDto>> ListNamedAsync(string kind, CancellationToken ct) => kind switch
    {
        "categories" => ListOf(db.Categories, ct), "vehicle-types" => ListOf(db.VehicleTypes, ct),
        "makes" => ListOf(db.Makes, ct), "connectors" => ListOf(db.Connectors, ct), _ => throw UnknownKind()
    };
    private static Task<List<NamedItemDto>> ListOf<T>(DbSet<T> set, CancellationToken ct) where T : NamedMaster =>
        set.AsNoTracking().OrderBy(x => x.SortOrder).ThenBy(x => x.Name).Select(x => new NamedItemDto(x.Id, x.Name, x.SortOrder, x.IsActive)).ToListAsync(ct);

    public Task<NamedItemDto> CreateNamedAsync(string kind, SaveNamedDto dto, CancellationToken ct) => kind switch
    {
        "categories" => CreateOf(db.Categories, kind, dto, ct), "vehicle-types" => CreateOf(db.VehicleTypes, kind, dto, ct),
        "makes" => CreateOf(db.Makes, kind, dto, ct), "connectors" => CreateOf(db.Connectors, kind, dto, ct), _ => throw UnknownKind()
    };
    private async Task<NamedItemDto> CreateOf<T>(DbSet<T> set, string kind, SaveNamedDto dto, CancellationToken ct) where T : NamedMaster, new()
    {
        var name = Text.Clean(dto.Name, 120);
        var lower = name.ToLower();
        if (await set.AnyAsync(x => x.Name.ToLower() == lower, ct)) throw ApiException.Conflict($"'{name}' already exists.");
        var e = new T { Name = name, SortOrder = dto.SortOrder, IsActive = dto.IsActive };
        set.Add(e);
        await Commit("MasterCreated", kind, e.Id, $"Created {kind} '{name}'", ct);
        return ToDto(e);
    }

    public Task<NamedItemDto> UpdateNamedAsync(string kind, string id, SaveNamedDto dto, CancellationToken ct) => kind switch
    {
        "categories" => UpdateOf(db.Categories, kind, id, dto, ct), "vehicle-types" => UpdateOf(db.VehicleTypes, kind, id, dto, ct),
        "makes" => UpdateOf(db.Makes, kind, id, dto, ct), "connectors" => UpdateOf(db.Connectors, kind, id, dto, ct), _ => throw UnknownKind()
    };
    private async Task<NamedItemDto> UpdateOf<T>(DbSet<T> set, string kind, string id, SaveNamedDto dto, CancellationToken ct) where T : NamedMaster
    {
        var e = await set.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw ApiException.NotFound();
        var name = Text.Clean(dto.Name, 120);
        var lower = name.ToLower();
        if (await set.AnyAsync(x => x.Name.ToLower() == lower && x.Id != id, ct)) throw ApiException.Conflict($"'{name}' already exists.");
        var old = e.Name; e.Name = name; e.SortOrder = dto.SortOrder; e.IsActive = dto.IsActive;
        await Commit("MasterUpdated", kind, id, $"Updated {kind} '{old}' -> '{name}'", ct);
        return ToDto(e);
    }

    public async Task DeleteNamedAsync(string kind, string id, CancellationToken ct)
    {
        int used = kind switch
        {
            "categories" => await db.Models.CountAsync(m => m.CategoryId == id, ct),
            "vehicle-types" => await db.Models.CountAsync(m => m.VehicleTypeId == id, ct),
            "makes" => await db.Models.CountAsync(m => m.MakeId == id, ct),
            "connectors" => await db.Drawings.IgnoreQueryFilters().CountAsync(d => d.ConnectorTypeId == id, ct),
            _ => throw UnknownKind()
        };
        if (used > 0) throw ApiException.Conflict($"This value is used by {used} record(s). Deactivate it instead of deleting.");
        object? e = kind switch
        {
            "categories" => await db.Categories.FindAsync([id], ct), "vehicle-types" => await db.VehicleTypes.FindAsync([id], ct),
            "makes" => await db.Makes.FindAsync([id], ct), _ => await db.Connectors.FindAsync([id], ct)
        };
        if (e is null) throw ApiException.NotFound();
        db.Remove(e);
        await Commit("MasterDeleted", kind, id, $"Deleted {kind} {id}", ct);
    }

    // ---------- Models ----------
    public Task<List<ModelDto>> ListModelsAsync(CancellationToken ct) =>
        db.Models.AsNoTracking().OrderBy(x => x.ModelName).ThenBy(x => x.Capacity)
            .Select(x => new ModelDto(x.Id, x.MakeId, x.VehicleTypeId, x.CategoryId, x.ModelName, x.Capacity, x.IsActive)).ToListAsync(ct);

    public async Task<ModelDto> SaveModelAsync(string? id, SaveModelDto dto, CancellationToken ct)
    {
        if (!await db.Makes.AnyAsync(x => x.Id == dto.MakeId, ct)) throw ApiException.BadRequest("Unknown make.", "makeId");
        if (!await db.VehicleTypes.AnyAsync(x => x.Id == dto.VehicleTypeId, ct)) throw ApiException.BadRequest("Unknown vehicle type.", "vehicleTypeId");
        if (!await db.Categories.AnyAsync(x => x.Id == dto.CategoryId, ct)) throw ApiException.BadRequest("Unknown category.", "categoryId");
        var name = Text.Clean(dto.Name, 120); var cap = Text.Clean(dto.Capacity, 40);
        if (await db.Models.AnyAsync(x => x.MakeId == dto.MakeId && x.VehicleTypeId == dto.VehicleTypeId && x.CategoryId == dto.CategoryId && x.ModelName == name && x.Capacity == cap && x.Id != id, ct))
            throw ApiException.Conflict("This model and capacity already exists for the selected make, type and category.");
        VehicleModel e;
        if (id is null) { e = new VehicleModel(); db.Models.Add(e); }
        else e = await db.Models.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw ApiException.NotFound();
        e.MakeId = dto.MakeId; e.VehicleTypeId = dto.VehicleTypeId; e.CategoryId = dto.CategoryId; e.ModelName = name; e.Capacity = cap; e.IsActive = dto.IsActive;
        await Commit(id is null ? "MasterCreated" : "MasterUpdated", "models", e.Id, $"{(id is null ? "Created" : "Updated")} model '{name}' {cap}", ct);
        return new ModelDto(e.Id, e.MakeId, e.VehicleTypeId, e.CategoryId, e.ModelName, e.Capacity, e.IsActive);
    }

    public async Task DeleteModelAsync(string id, CancellationToken ct)
    {
        var used = await db.Drawings.IgnoreQueryFilters().CountAsync(d => d.ModelId == id, ct);
        if (used > 0) throw ApiException.Conflict($"This model is used by {used} drawing(s). Deactivate it instead of deleting.");
        var e = await db.Models.FindAsync([id], ct) ?? throw ApiException.NotFound();
        db.Models.Remove(e);
        await Commit("MasterDeleted", "models", id, $"Deleted model '{e.ModelName}'", ct);
    }

    // ---------- Voltage / Ah ----------
    public Task<List<VoltageDto>> ListVoltagesAsync(CancellationToken ct) =>
        db.Voltages.AsNoTracking().OrderBy(x => x.ValueV).Select(x => new VoltageDto(x.Id, x.ValueV, x.IsActive)).ToListAsync(ct);

    public async Task<VoltageDto> SaveVoltageAsync(string? id, SaveVoltageDto dto, CancellationToken ct)
    {
        if (await db.Voltages.AnyAsync(x => x.ValueV == dto.ValueV && x.Id != id, ct)) throw ApiException.Conflict($"{dto.ValueV} V already exists.");
        VoltagePreset e;
        if (id is null) { e = new VoltagePreset(); db.Voltages.Add(e); } else e = await db.Voltages.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw ApiException.NotFound();
        e.ValueV = dto.ValueV; e.IsActive = dto.IsActive;
        await Commit(id is null ? "MasterCreated" : "MasterUpdated", "voltages", e.Id, $"{dto.ValueV} V", ct);
        return new VoltageDto(e.Id, e.ValueV, e.IsActive);
    }

    public async Task DeleteVoltageAsync(string id, CancellationToken ct)
    {
        var e = await db.Voltages.FindAsync([id], ct) ?? throw ApiException.NotFound();
        var used = await db.Drawings.IgnoreQueryFilters().CountAsync(d => d.VoltageV == e.ValueV, ct);
        if (used > 0) throw ApiException.Conflict($"{e.ValueV} V is used by {used} drawing(s). Deactivate it instead of deleting.");
        db.Voltages.Remove(e);
        await Commit("MasterDeleted", "voltages", id, $"Deleted {e.ValueV} V", ct);
    }

    public async Task<List<AhDto>> ListAhAsync(CancellationToken ct) =>
        (await db.AhRatings.AsNoTracking().OrderBy(x => x.Value).ThenBy(x => x.Standard).ToListAsync(ct)).Select(x => new AhDto(x.Id, x.Value, x.Standard, x.Label, x.IsActive)).ToList();

    public async Task<AhDto> SaveAhAsync(string? id, SaveAhDto dto, CancellationToken ct)
    {
        var std = Text.Clean(dto.Standard, 20).ToUpperInvariant();
        if (await db.AhRatings.AnyAsync(x => x.Value == dto.Value && x.Standard == std && x.Id != id, ct)) throw ApiException.Conflict("This Ah rating already exists.");
        AhRating e;
        if (id is null) { e = new AhRating(); db.AhRatings.Add(e); } else e = await db.AhRatings.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw ApiException.NotFound();
        e.Value = dto.Value; e.Standard = std; e.IsActive = dto.IsActive;
        await Commit(id is null ? "MasterCreated" : "MasterUpdated", "ah-ratings", e.Id, $"Ah {e.Label}", ct);
        return new AhDto(e.Id, e.Value, e.Standard, e.Label, e.IsActive);
    }

    public async Task DeleteAhAsync(string id, CancellationToken ct)
    {
        var e = await db.AhRatings.FindAsync([id], ct) ?? throw ApiException.NotFound();
        var used = await db.Drawings.IgnoreQueryFilters().CountAsync(d => d.AhValue == e.Value && d.AhStandard == e.Standard, ct);
        if (used > 0) throw ApiException.Conflict($"{e.Label} Ah is used by {used} drawing(s). Deactivate it instead of deleting.");
        db.AhRatings.Remove(e);
        await Commit("MasterDeleted", "ah-ratings", id, $"Deleted Ah {e.Label}", ct);
    }
}
