namespace DrawingPortal.Api.Services;

/// <summary>Wakes the e-mail worker immediately (used for sign-in codes) instead of waiting for the next poll.</summary>
public sealed class EmailSignal
{
    private readonly SemaphoreSlim _s = new(0, int.MaxValue);
    public void Notify() => _s.Release();
    public async Task WaitAsync(TimeSpan max, CancellationToken ct) { await _s.WaitAsync(max, ct); while (_s.CurrentCount > 0 && await _s.WaitAsync(0, ct)) { } }
}
