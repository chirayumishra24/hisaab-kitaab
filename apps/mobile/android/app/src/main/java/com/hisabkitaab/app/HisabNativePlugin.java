package com.hisabkitaab.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.ContactsContract;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Phone features for the web app running inside the shell.
 *
 * - pickContact: opens the system contact picker. Android grants read access to
 *   just the picked number, so no READ_CONTACTS permission is needed.
 * - openSms / openWhatsApp: open the user's own SMS app or WhatsApp with the
 *   message filled in, so reminders go out from their own number.
 * - share: the system share sheet (Android WebView has no navigator.share).
 */
@CapacitorPlugin(name = "HisabNative")
public class HisabNativePlugin extends Plugin {

    private static final String[] WHATSAPP_PACKAGES = { "com.whatsapp", "com.whatsapp.w4b" };

    @PluginMethod
    public void pickContact(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_PICK, ContactsContract.CommonDataKinds.Phone.CONTENT_URI);
        try {
            startActivityForResult(call, intent, "onContactPicked");
        } catch (ActivityNotFoundException e) {
            call.reject("No contacts app found", "UNAVAILABLE");
        }
    }

    @ActivityCallback
    private void onContactPicked(PluginCall call, ActivityResult result) {
        if (call == null) return;
        JSObject out = new JSObject();
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            out.put("cancelled", true);
            call.resolve(out);
            return;
        }
        Uri uri = result.getData().getData();
        String[] projection = {
            ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
            ContactsContract.CommonDataKinds.Phone.NUMBER
        };
        try (Cursor cursor = getContext().getContentResolver().query(uri, projection, null, null, null)) {
            if (cursor == null || !cursor.moveToFirst()) {
                call.reject("Could not read the contact", "READ_FAILED");
                return;
            }
            out.put("cancelled", false);
            out.put("name", cursor.getString(0));
            out.put("phone", cursor.getString(1));
            call.resolve(out);
        } catch (Exception e) {
            call.reject("Could not read the contact", "READ_FAILED", e);
        }
    }

    @PluginMethod
    public void openSms(PluginCall call) {
        String to = call.getString("to", "");
        String body = call.getString("body", "");
        Intent intent = new Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:" + Uri.encode(to)));
        intent.putExtra("sms_body", body);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(intent);
            call.resolve();
        } catch (ActivityNotFoundException e) {
            call.reject("No SMS app found", "UNAVAILABLE");
        }
    }

    @PluginMethod
    public void openWhatsApp(PluginCall call) {
        String digits = call.getString("to", "").replaceAll("\\D", "");
        String body = call.getString("body", "");
        Uri uri = Uri.parse("https://api.whatsapp.com/send?phone=" + digits + "&text=" + Uri.encode(body));
        for (String pkg : WHATSAPP_PACKAGES) {
            Intent intent = new Intent(Intent.ACTION_VIEW, uri).setPackage(pkg).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            try {
                getContext().startActivity(intent);
                call.resolve();
                return;
            } catch (ActivityNotFoundException ignored) {
                // Try the next WhatsApp flavour.
            }
        }
        try {
            // Not installed: let the browser handle it (offers to install WhatsApp).
            getContext().startActivity(new Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            call.resolve();
        } catch (ActivityNotFoundException e) {
            call.reject("WhatsApp is not installed", "UNAVAILABLE");
        }
    }

    @PluginMethod
    public void share(PluginCall call) {
        String text = call.getString("text", "");
        Intent send = new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text);
        Intent chooser = Intent.createChooser(send, null).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(chooser);
            call.resolve();
        } catch (ActivityNotFoundException e) {
            call.reject("No app can share text", "UNAVAILABLE");
        }
    }
}
