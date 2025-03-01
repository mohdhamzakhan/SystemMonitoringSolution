using System.IO;
using System.Security.Cryptography;
using System.Text;

public class CredentialService
{
    #region Encrypt Password

    /// <summary>
    /// Encrypt a string using dual encryption method. Return a encrypted cipher Text
    /// </summary>
    /// <param name="toEncrypt">string to be encrypted</param>
    /// <param name="useHashing">use hashing? send to for extra secirity</param>
    /// <returns></returns>
    public string Encrypt(string toEncrypt, bool useHashing)
    {
        try
        {
            byte[] keyArray;
            byte[] toEncryptArray = UTF8Encoding.UTF8.GetBytes(toEncrypt);

            // Get the key from config file
            //string key = (string)settingsReader.GetValue("SecurityKey", typeof(String));
            string secretKey = "MEAI.123";
            string key = secretKey;
            //System.Windows.Forms.MessageBox.Show(key);
            if (useHashing)
            {
                MD5CryptoServiceProvider hashmd5 = new MD5CryptoServiceProvider();
                keyArray = hashmd5.ComputeHash(UTF8Encoding.UTF8.GetBytes(key));
                hashmd5.Clear();
            }
            else
                keyArray = UTF8Encoding.UTF8.GetBytes(key);

            TripleDESCryptoServiceProvider tdes = new TripleDESCryptoServiceProvider();
            tdes.Key = keyArray;
            tdes.Mode = CipherMode.ECB;
            tdes.Padding = PaddingMode.PKCS7;

            ICryptoTransform cTransform = tdes.CreateEncryptor();
            byte[] resultArray = cTransform.TransformFinalBlock(toEncryptArray, 0, toEncryptArray.Length);

            tdes.Clear();
            var encrypted = Convert.ToBase64String(resultArray, 0, resultArray.Length);
            return ChangeSPChart(encrypted);
        }
        // here I change it
        catch { return null; }
    }

    #endregion Encrypt Password

    #region Decrypt Password

    /// <summary>
    /// DeCrypt a string using dual encryption method. Return a DeCrypted clear string
    /// </summary>
    /// <param name="cipherString">encrypted string</param>
    /// <param name="useHashing">Did you use hashing to encrypt this data? pass true is yes</param>
    /// <returns></returns>
    public string Decrypt(string cipherString, bool useHashing)
    {
        cipherString = FixSPChart(cipherString);

        byte[] keyArray;
        byte[] toEncryptArray = Convert.FromBase64String(cipherString);

        //Get your key from config file to open the lock!
        //string key = (string)settingsReader.GetValue("SecurityKey", typeof(String));

        string key = "MEAI.123";

        if (useHashing)
        {
            MD5CryptoServiceProvider hashmd5 = new MD5CryptoServiceProvider();
            keyArray = hashmd5.ComputeHash(UTF8Encoding.UTF8.GetBytes(key));
            hashmd5.Clear();
        }
        else
            keyArray = UTF8Encoding.UTF8.GetBytes(key);

        TripleDESCryptoServiceProvider tdes = new TripleDESCryptoServiceProvider();
        tdes.Key = keyArray;
        tdes.Mode = CipherMode.ECB;
        tdes.Padding = PaddingMode.PKCS7;

        ICryptoTransform cTransform = tdes.CreateDecryptor();
        byte[] resultArray = cTransform.TransformFinalBlock(toEncryptArray, 0, toEncryptArray.Length);

        tdes.Clear();
        return UTF8Encoding.UTF8.GetString(resultArray);
    }

    #endregion Decrypt Password

    #region ChangeSPChart

    public static string ChangeSPChart(string sTheInput)
    {
        StringBuilder sRetMe = new StringBuilder(sTheInput);

        sRetMe.Replace('+', '-');
        sRetMe.Replace('/', '*');
        sRetMe.Replace('=', '!');
        sRetMe.Replace("'", "''");

        return sRetMe.ToString();
    }

    #endregion ChangeSPChart

    #region FixSPChart

    public static string FixSPChart(string sTheInput)
    {
        StringBuilder sRetMe = new StringBuilder(sTheInput);

        sRetMe.Replace('-', '+');
        sRetMe.Replace('*', '/');
        sRetMe.Replace('!', '=');
        sRetMe.Replace("''", "'");

        return sRetMe.ToString();
    }

    #endregion FixSPChart
}
