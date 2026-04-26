import React, { useEffect, useMemo, useState } from "react";
import { View, StyleSheet, Pressable, ActivityIndicator, ScrollView, Switch } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { LockedFeature } from "@/components/LockedFeature";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/components/Toast";
import { useEntitlements } from "@/lib/entitlements";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

interface ShopProfileMe {
  displayName: string | null;
  slug: string | null;
  description: string | null;
  logoUrl: string | null;
  location: string | null;
  serviceArea: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  specialties: string[] | null;
  certifications: string[] | null;
  yearsInBusiness: number | null;
  hours: Record<string, string> | null;
  isPublic: boolean | null;
}

export default function ShopProfileEditorScreen() {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { hasFeature } = useEntitlements();
  const canUse = hasFeature("shop_profile");

  const { data, isLoading } = useQuery<{ profile: ShopProfileMe | null; credibility?: unknown }>({
    queryKey: ["/api/shop-profile/me"],
    enabled: canUse,
  });

  const [displayName, setDisplayName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [location, setLocation] = useState("");
  const [serviceArea, setServiceArea] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [specialties, setSpecialties] = useState("");
  const [certifications, setCertifications] = useState("");
  const [years, setYears] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [hours, setHours] = useState<Record<string, string>>({});

  useEffect(() => {
    const profile = data?.profile;
    if (!profile) return;
    setDisplayName(profile.displayName ?? "");
    setSlug(profile.slug ?? "");
    setDescription(profile.description ?? "");
    setLogoUrl(profile.logoUrl ?? "");
    setLocation(profile.location ?? "");
    setServiceArea(profile.serviceArea ?? "");
    setAddress(profile.address ?? "");
    setPhone(profile.phone ?? "");
    setEmail(profile.email ?? "");
    setWebsite(profile.website ?? "");
    setSpecialties((profile.specialties ?? []).join(", "));
    setCertifications((profile.certifications ?? []).join(", "));
    setYears(profile.yearsInBusiness != null ? String(profile.yearsInBusiness) : "");
    setIsPublic(!!profile.isPublic);
    setHours(profile.hours ?? {});
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        displayName: displayName.trim() || null,
        slug: slug.trim().toLowerCase() || null,
        description: description.trim() || null,
        logoUrl: logoUrl.trim() || null,
        location: location.trim() || null,
        serviceArea: serviceArea.trim() || null,
        address: address.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        website: website.trim() || null,
        specialties: splitList(specialties),
        certifications: splitList(certifications),
        yearsInBusiness: years.trim() ? Math.max(0, parseInt(years, 10) || 0) : null,
        hours,
        isPublic,
      };
      const res = await apiRequest("PUT", "/api/shop-profile/me", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shop-profile/me"] });
      toast.show("Shop profile saved", "success");
    },
    onError: (err: Error) => {
      toast.show(err.message || "Failed to save", "error");
    },
  });

  const publicUrl = useMemo(() => {
    if (!slug) return "";
    try {
      return new URL(`/shops/${slug}`, getApiUrl()).toString();
    } catch {
      return "";
    }
  }, [slug]);

  const onCopyLink = async () => {
    if (!publicUrl) return;
    await Clipboard.setStringAsync(publicUrl);
    toast.show("Link copied", "success");
  };

  if (!canUse) {
    return (
      <ScrollView
        style={{ backgroundColor: theme.backgroundRoot }}
        contentContainerStyle={{ paddingTop: headerHeight + Spacing.lg, paddingHorizontal: Spacing.lg }}
      >
        <LockedFeature
          feature="shop_profile"
          title="Public shop profile"
          description="Publish a public-facing shop page with your services, hours, and contact info."
          onUpgrade={() => navigation.navigate("Subscription")}
        />
      </ScrollView>
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  return (
    <KeyboardAwareScrollViewCompat
      style={{ backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{ paddingTop: headerHeight + Spacing.md, paddingHorizontal: Spacing.lg, paddingBottom: Spacing["2xl"] }}
    >
      <ThemedText type="h2">Shop profile</ThemedText>
      <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.xxs, marginBottom: Spacing.lg }}>
        This information is shown on your public TorqueShed shop page.
      </ThemedText>

      <Card elevation={2} style={styles.card}>
        <ThemedText type="h4">Identity</ThemedText>
        <Field label="Shop name">
          <Input value={displayName} onChangeText={setDisplayName} placeholder="e.g. Northgate Auto" testID="input-shop-name" />
        </Field>
        <Field label="Slug (used in your link)">
          <Input value={slug} onChangeText={(t) => setSlug(t.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="northgate-auto" autoCapitalize="none" testID="input-shop-slug" />
          {publicUrl ? (
            <Pressable onPress={onCopyLink} style={styles.linkRow} testID="button-copy-shop-link">
              <Feather name="link" size={14} color={theme.primary} />
              <ThemedText type="small" style={{ color: theme.primary, marginLeft: 6 }}>{publicUrl}</ThemedText>
            </Pressable>
          ) : null}
        </Field>
        <Field label="Logo image URL">
          <Input value={logoUrl} onChangeText={setLogoUrl} placeholder="https://…" autoCapitalize="none" testID="input-shop-logo" />
        </Field>
        <Field label="Description">
          <Input value={description} onChangeText={setDescription} placeholder="Tell customers what you do" multiline numberOfLines={4} style={{ minHeight: 90 }} testID="input-shop-description" />
        </Field>
      </Card>

      <Card elevation={2} style={styles.card}>
        <ThemedText type="h4">Contact & location</ThemedText>
        <Field label="Phone"><Input value={phone} onChangeText={setPhone} placeholder="(555) 555-5555" keyboardType="phone-pad" testID="input-shop-phone" /></Field>
        <Field label="Email"><Input value={email} onChangeText={setEmail} placeholder="shop@example.com" keyboardType="email-address" autoCapitalize="none" testID="input-shop-email" /></Field>
        <Field label="Website"><Input value={website} onChangeText={setWebsite} placeholder="https://…" autoCapitalize="none" testID="input-shop-website" /></Field>
        <Field label="City / region"><Input value={location} onChangeText={setLocation} placeholder="Seattle, WA" testID="input-shop-location" /></Field>
        <Field label="Service area"><Input value={serviceArea} onChangeText={setServiceArea} placeholder="Within 25mi of Seattle" testID="input-shop-service-area" /></Field>
        <Field label="Street address"><Input value={address} onChangeText={setAddress} placeholder="123 Main St" testID="input-shop-address" /></Field>
      </Card>

      <Card elevation={2} style={styles.card}>
        <ThemedText type="h4">Credibility</ThemedText>
        <Field label="Years in business"><Input value={years} onChangeText={setYears} placeholder="10" keyboardType="number-pad" testID="input-shop-years" /></Field>
        <Field label="Specialties (comma separated)"><Input value={specialties} onChangeText={setSpecialties} placeholder="Diesel, Brakes, Diagnostics" testID="input-shop-specialties" /></Field>
        <Field label="Certifications (comma separated)"><Input value={certifications} onChangeText={setCertifications} placeholder="ASE Master, GM World Class" testID="input-shop-certifications" /></Field>
      </Card>

      <Card elevation={2} style={styles.card}>
        <ThemedText type="h4">Hours</ThemedText>
        <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>Leave blank for closed days.</ThemedText>
        {DAYS.map((day) => (
          <Field key={day} label={day.charAt(0).toUpperCase() + day.slice(1)}>
            <Input
              value={hours[day] ?? ""}
              onChangeText={(t) => setHours((h) => ({ ...h, [day]: t }))}
              placeholder="8:00am – 6:00pm"
              testID={`input-hours-${day}`}
            />
          </Field>
        ))}
      </Card>

      <Card elevation={2} style={styles.card}>
        <View style={styles.publicRow}>
          <View style={{ flex: 1, paddingRight: Spacing.md }}>
            <ThemedText type="h4">Publish profile</ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 2 }}>
              When on, your shop page is reachable at the link above.
            </ThemedText>
          </View>
          <Switch
            value={isPublic}
            onValueChange={setIsPublic}
            trackColor={{ true: theme.primary, false: theme.cardBorder }}
            thumbColor="#FFFFFF"
            testID="switch-shop-public"
          />
        </View>
      </Card>

      <Button onPress={() => save.mutate()} disabled={save.isPending} testID="button-save-shop-profile">
        {save.isPending ? "Saving…" : "Save profile"}
      </Button>
    </KeyboardAwareScrollViewCompat>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <View style={{ marginTop: Spacing.sm }}>
      <ThemedText type="caption" style={{ color: theme.textMuted, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>{label}</ThemedText>
      {children}
    </View>
  );
}

function splitList(s: string): string[] {
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: { padding: Spacing.lg, marginBottom: Spacing.md, borderRadius: BorderRadius.xl },
  linkRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  publicRow: { flexDirection: "row", alignItems: "center" },
});
