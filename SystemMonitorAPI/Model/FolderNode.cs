namespace SystemMonitorAPI.Model
{
    // Models/FolderNode.cs
    public class FolderNode
    {
        public string Name { get; set; }
        public string FullPath { get; set; }
        public List<AclEntry> Permissions { get; set; } = new();
        public bool HasChildren { get; set; }
        public List<FolderNode> Children { get; set; } = new();
    }

    public class AclEntry
    {
        public string IdentityReference { get; set; }
        public string FileSystemRights { get; set; }
        public string AccessControlType { get; set; } // Allow/Deny
        public bool IsInherited { get; set; }
    }
}
