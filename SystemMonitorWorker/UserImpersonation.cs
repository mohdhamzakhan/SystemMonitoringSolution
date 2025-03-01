using System;
using System.Runtime.InteropServices;
using System.Security.Principal;

public class UserImpersonation : IDisposable
{
    private IntPtr _tokenHandle = IntPtr.Zero;

    public bool ImpersonateUser(string domain, string username, string password, out WindowsIdentity identity)
    {
        identity = null;

        if (LogonUser(username, domain, password, 2, 0, ref _tokenHandle))
        {
            identity = new WindowsIdentity(_tokenHandle);
            return identity != null;
        }

        return false;
    }

    public void Dispose()
    {
        if (_tokenHandle != IntPtr.Zero)
        {
            CloseHandle(_tokenHandle);
            _tokenHandle = IntPtr.Zero;
        }
    }

    [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    private static extern bool LogonUser(string lpszUsername, string lpszDomain, string lpszPassword,
        int dwLogonType, int dwLogonProvider, ref IntPtr phToken);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool CloseHandle(IntPtr hObject);
}
