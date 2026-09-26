// GENERATED from DraconDex-SDB design/tokens.json by design/tokens.mjs — do not edit here.
// ignore_for_file: constant_identifier_names

import 'package:flutter/painting.dart';

/// One theme's palette — the same names EXE uses as CSS custom properties
/// (t3Aa is --t3-aa). button/onAccent/onButton are optional there too.
class DdxPalette {
  const DdxPalette({
    required this.bg,
    required this.surface,
    required this.raised,
    required this.hover,
    required this.border,
    required this.t1,
    required this.t2,
    required this.t3,
    required this.t3Aa,
    required this.accent,
    required this.accentH,
    required this.danger,
    required this.success,
    this.button,
    this.onAccent,
    this.onButton,
  });

  final Color bg;
  final Color surface;
  final Color raised;
  final Color hover;
  final Color border;
  final Color t1;
  final Color t2;
  final Color t3;
  final Color t3Aa;
  final Color accent;
  final Color accentH;
  final Color danger;
  final Color success;
  final Color? button;
  final Color? onAccent;
  final Color? onButton;

  /// Muted text that reaches 4.5:1 — use this, not t3, for text.
  Color get textMuted => t3Aa;
}

/// Ink colours a palette may alias for on-accent / on-button.
abstract final class DdxInk {
  static const Color inkDark = Color(0xFF1A1A26);
}

/// Every theme, in the order the pickers list them.
const Map<String, DdxPalette> ddxPalettes = {
  'daylight': DdxPalette(bg: Color(0xFFF4F6FB), surface: Color(0xFFFFFFFF), raised: Color(0xFFEEF1F7), hover: Color(0xFFE2E7F0), border: Color(0xFFCCD3DF), t1: Color(0xFF172033), t2: Color(0xFF596274), t3: Color(0xFF8A94A6), t3Aa: Color(0xFF636D7F), accent: Color(0xFF2563EB), accentH: Color(0xFF3B82F6), danger: Color(0xFFDC2626), success: Color(0xFF16A34A)),
  'moonlight': DdxPalette(bg: Color(0xFF101620), surface: Color(0xFF182231), raised: Color(0xFF223044), hover: Color(0xFF2D3B52), border: Color(0xFF334258), t1: Color(0xFFEDF4FF), t2: Color(0xFFA6B3C7), t3: Color(0xFF66758C), t3Aa: Color(0xFF8C99AC), accent: Color(0xFF7C9CFF), accentH: Color(0xFF9BB5FF), danger: Color(0xFFF87171), success: Color(0xFF34D399), onAccent: Color(0xFF1A1A26), onButton: Color(0xFF1A1A26)),
  'midnight': DdxPalette(bg: Color(0xFF0F0F13), surface: Color(0xFF18181F), raised: Color(0xFF22222D), hover: Color(0xFF2A2A38), border: Color(0xFF2E2E3F), t1: Color(0xFFE8E8F0), t2: Color(0xFF9090A8), t3: Color(0xFF5A5A72), t3Aa: Color(0xFF8A8A9D), accent: Color(0xFF6366F1), accentH: Color(0xFF818CF8), danger: Color(0xFFEF4444), success: Color(0xFF22C55E)),
  'rainbow': DdxPalette(bg: Color(0xFFFDF3FB), surface: Color(0xFFFFFFFF), raised: Color(0xFFFBECF7), hover: Color(0xFFF6E0F2), border: Color(0xFFECD2E9), t1: Color(0xFF3A2B46), t2: Color(0xFF6D5B7C), t3: Color(0xFFA493B3), t3Aa: Color(0xFF776785), accent: Color(0xFFD6249F), accentH: Color(0xFF7C3AED), danger: Color(0xFFFB7185), success: Color(0xFF22C55E)),
  'redEclipse': DdxPalette(bg: Color(0xFF0A0808), surface: Color(0xFF150F0F), raised: Color(0xFF201616), hover: Color(0xFF2B1E1E), border: Color(0xFF3A2624), t1: Color(0xFFF6ECE4), t2: Color(0xFFBB9A8A), t3: Color(0xFF7C5F52), t3Aa: Color(0xFF967D71), accent: Color(0xFFB8703C), accentH: Color(0xFFDC2626), danger: Color(0xFFF97316), success: Color(0xFF22C55E)),
  'clearSky': DdxPalette(bg: Color(0xFFE8F3FF), surface: Color(0xFFFFFFFF), raised: Color(0xFFD8EBFF), hover: Color(0xFFC4DDFB), border: Color(0xFFAACBEE), t1: Color(0xFF22306E), t2: Color(0xFF4F61A3), t3: Color(0xFF8497C4), t3Aa: Color(0xFF56679C), accent: Color(0xFF00BFFF), accentH: Color(0xFF4169E1), danger: Color(0xFFDC2626), success: Color(0xFF16A34A), button: Color(0xFF0080FF), onAccent: Color(0xFF1A1A26)),
  'clearStar': DdxPalette(bg: Color(0xFF0A1128), surface: Color(0xFF101D42), raised: Color(0xFF16254F), hover: Color(0xFF1D2F61), border: Color(0xFF34285E), t1: Color(0xFFF5F3FF), t2: Color(0xFFB9B6D9), t3: Color(0xFF6F6A94), t3Aa: Color(0xFF8E8AAD), accent: Color(0xFF7C3AED), accentH: Color(0xFFC4B5FD), danger: Color(0xFFEF4444), success: Color(0xFF22C55E)),
  'afterRain': DdxPalette(bg: Color(0xFFF0DBE8), surface: Color(0xFFEBE3EA), raised: Color(0xFFC6EBD5), hover: Color(0xFFF0D6B4), border: Color(0xFFC4B6EC), t1: Color(0xFF463A5C), t2: Color(0xFF7A6C96), t3: Color(0xFFAA9EC6), t3Aa: Color(0xFF6A5E82), accent: Color(0xFF4FB4F5), accentH: Color(0xFFEF8FE0), danger: Color(0xFFFB7185), success: Color(0xFF4FD699), onAccent: Color(0xFF1A1A26), onButton: Color(0xFF1A1A26)),
  'atDawn': DdxPalette(bg: Color(0xFFFDEEE8), surface: Color(0xFFFFFFFF), raised: Color(0xFFFFE4E1), hover: Color(0xFFFFD6CC), border: Color(0xFFFFC2B8), t1: Color(0xFF5C2A3A), t2: Color(0xFF8A5468), t3: Color(0xFFC191A0), t3Aa: Color(0xFF8C5B6B), accent: Color(0xFFFF69B4), accentH: Color(0xFFFF6F3C), danger: Color(0xFFDC2626), success: Color(0xFF16A34A), button: Color(0xFFFFB627), onAccent: Color(0xFF1A1A26), onButton: Color(0xFF1A1A26)),
  'atDusk': DdxPalette(bg: Color(0xFF1A0F2E), surface: Color(0xFF241640), raised: Color(0xFF2F1D52), hover: Color(0xFF3A2563), border: Color(0xFF46296E), t1: Color(0xFFF3E8FF), t2: Color(0xFFC4A8DD), t3: Color(0xFF8870A8), t3Aa: Color(0xFF9B86B8), accent: Color(0xFFB24BF3), accentH: Color(0xFFC9748A), danger: Color(0xFFFB7185), success: Color(0xFF22C55E), button: Color(0xFFD6473C)),
  'atDay': DdxPalette(bg: Color(0xFFFFFAF0), surface: Color(0xFFFFFFFF), raised: Color(0xFFFFF3D6), hover: Color(0xFFFFE9B3), border: Color(0xFFFFD97D), t1: Color(0xFF4A3A12), t2: Color(0xFF7A6230), t3: Color(0xFFB39A63), t3Aa: Color(0xFF826D3D), accent: Color(0xFFE8A93C), accentH: Color(0xFFFFCBA4), danger: Color(0xFFDC2626), success: Color(0xFF16A34A), button: Color(0xFFD4A017), onAccent: Color(0xFF1A1A26), onButton: Color(0xFF1A1A26)),
  'blueEclipse': DdxPalette(bg: Color(0xFF05050F), surface: Color(0xFF0B0B1F), raised: Color(0xFF10102C), hover: Color(0xFF161638), border: Color(0xFF1C1C44), t1: Color(0xFFE8E8F5), t2: Color(0xFF9797B8), t3: Color(0xFF55557A), t3Aa: Color(0xFF7B7B9A), accent: Color(0xFF191970), accentH: Color(0xFF000080), danger: Color(0xFFEF4444), success: Color(0xFF22C55E), button: Color(0xFFC9CCD4), onButton: Color(0xFF1A1A26)),
  'clearAurora': DdxPalette(bg: Color(0xFF071A17), surface: Color(0xFF0C2621), raised: Color(0xFF123430), hover: Color(0xFF18423C), border: Color(0xFF1F524A), t1: Color(0xFFE6FFF6), t2: Color(0xFF8FC7BA), t3: Color(0xFF557A72), t3Aa: Color(0xFF7B9D94), accent: Color(0xFF2DD4BF), accentH: Color(0xFFE879F9), danger: Color(0xFFF87171), success: Color(0xFF4ADE80), onAccent: Color(0xFF1A1A26), onButton: Color(0xFF1A1A26)),
  'atTwilight': DdxPalette(bg: Color(0xFF13111F), surface: Color(0xFF1C1930), raised: Color(0xFF272040), hover: Color(0xFF332A52), border: Color(0xFF3D3363), t1: Color(0xFFECE8FF), t2: Color(0xFFA9A0CC), t3: Color(0xFF6B6390), t3Aa: Color(0xFF8E87AE), accent: Color(0xFF8B5CF6), accentH: Color(0xFFA78BFA), danger: Color(0xFFF87171), success: Color(0xFF34D399)),
  'atSunset': DdxPalette(bg: Color(0xFF1F1013), surface: Color(0xFF2C161B), raised: Color(0xFF3A1E24), hover: Color(0xFF48262E), border: Color(0xFF5A2F38), t1: Color(0xFFFFE9E3), t2: Color(0xFFD5A396), t3: Color(0xFF996A60), t3Aa: Color(0xFFAD837A), accent: Color(0xFFFB7185), accentH: Color(0xFFF59E0B), danger: Color(0xFFEF4444), success: Color(0xFF22C55E), button: Color(0xFFF97316), onAccent: Color(0xFF1A1A26), onButton: Color(0xFF1A1A26)),
  'clearComet': DdxPalette(bg: Color(0xFF08130D), surface: Color(0xFF0E2016), raised: Color(0xFF152D1F), hover: Color(0xFF1D3B28), border: Color(0xFF264A33), t1: Color(0xFFE6F9EC), t2: Color(0xFF98C4A6), t3: Color(0xFF5C7D67), t3Aa: Color(0xFF789682), accent: Color(0xFF10B981), accentH: Color(0xFF34D399), danger: Color(0xFFF87171), success: Color(0xFF22C55E), onAccent: Color(0xFF1A1A26), onButton: Color(0xFF1A1A26)),
  'atDaybreak': DdxPalette(bg: Color(0xFFEEF7FB), surface: Color(0xFFFFFFFF), raised: Color(0xFFE0F0F7), hover: Color(0xFFCFE7F1), border: Color(0xFFB3D5E4), t1: Color(0xFF123040), t2: Color(0xFF3F5F70), t3: Color(0xFF7A97A6), t3Aa: Color(0xFF52707F), accent: Color(0xFF0891B2), accentH: Color(0xFF06B6D4), danger: Color(0xFFDC2626), success: Color(0xFF059669)),
  'afterSunset': DdxPalette(bg: Color(0xFF121110), surface: Color(0xFF1C1A18), raised: Color(0xFF272422), hover: Color(0xFF332F2C), border: Color(0xFF403A35), t1: Color(0xFFF7F0E9), t2: Color(0xFFC2B2A3), t3: Color(0xFF82766A), t3Aa: Color(0xFF958A7E), accent: Color(0xFFF97316), accentH: Color(0xFFFBBF24), danger: Color(0xFFEF4444), success: Color(0xFF22C55E), onAccent: Color(0xFF1A1A26), onButton: Color(0xFF1A1A26)),
  'atSunrise': DdxPalette(bg: Color(0xFFFDF0F4), surface: Color(0xFFFFFFFF), raised: Color(0xFFFFE4EC), hover: Color(0xFFFFD3E0), border: Color(0xFFF6BCCF), t1: Color(0xFF5A2740), t2: Color(0xFF8F5570), t3: Color(0xFFC091A5), t3Aa: Color(0xFF8C5B71), accent: Color(0xFFEC4899), accentH: Color(0xFFF9A8D4), danger: Color(0xFFDC2626), success: Color(0xFF16A34A), button: Color(0xFFFB7185), onButton: Color(0xFF1A1A26)),
  'atNight': DdxPalette(bg: Color(0xFF04141C), surface: Color(0xFF08202B), raised: Color(0xFF0C2C3A), hover: Color(0xFF113A4B), border: Color(0xFF17495D), t1: Color(0xFFE0F7FF), t2: Color(0xFF8BBCCB), t3: Color(0xFF527481), t3Aa: Color(0xFF7695A1), accent: Color(0xFF0EA5E9), accentH: Color(0xFF22D3EE), danger: Color(0xFFF87171), success: Color(0xFF2DD4BF), onAccent: Color(0xFF1A1A26), onButton: Color(0xFF1A1A26)),
  'atNoon': DdxPalette(bg: Color(0xFFFAF3E6), surface: Color(0xFFFFFDF8), raised: Color(0xFFF3E6CF), hover: Color(0xFFECD9B8), border: Color(0xFFDCC59A), t1: Color(0xFF4A3520), t2: Color(0xFF7C6242), t3: Color(0xFFAB9068), t3Aa: Color(0xFF7C6445), accent: Color(0xFFC2703D), accentH: Color(0xFFE0913F), danger: Color(0xFFDC2626), success: Color(0xFF15803D), button: Color(0xFFB45309)),
  'clearDusk': DdxPalette(bg: Color(0xFFF5F0FC), surface: Color(0xFFFFFFFF), raised: Color(0xFFEDE4FB), hover: Color(0xFFE0D2F6), border: Color(0xFFCDB8EC), t1: Color(0xFF3A2C52), t2: Color(0xFF6B5A86), t3: Color(0xFF9D8CB8), t3Aa: Color(0xFF70618A), accent: Color(0xFF8B5CF6), accentH: Color(0xFFA78BFA), danger: Color(0xFFDC2626), success: Color(0xFF16A34A)),
  'atMidnight': DdxPalette(bg: Color(0xFF050608), surface: Color(0xFF0C0E14), raised: Color(0xFF12151E), hover: Color(0xFF191D29), border: Color(0xFF232838), t1: Color(0xFFE6EBF5), t2: Color(0xFF8B93A8), t3: Color(0xFF525A70), t3Aa: Color(0xFF788093), accent: Color(0xFF4F7CC4), accentH: Color(0xFF6F9CE4), danger: Color(0xFFEF4444), success: Color(0xFF22C55E)),
  'clearMoon': DdxPalette(bg: Color(0xFF141821), surface: Color(0xFF1D222E), raised: Color(0xFF262D3B), hover: Color(0xFF313947), border: Color(0xFF3C4556), t1: Color(0xFFEEF1F7), t2: Color(0xFFAEB6C6), t3: Color(0xFF6F7789), t3Aa: Color(0xFF8D94A3), accent: Color(0xFF5B6B94), accentH: Color(0xFF8996C0), danger: Color(0xFFF87171), success: Color(0xFF34D399)),
  'clearGalaxy': DdxPalette(bg: Color(0xFF0D0A1F), surface: Color(0xFF161233), raised: Color(0xFF1F1A45), hover: Color(0xFF292158), border: Color(0xFF342A6B), t1: Color(0xFFF0EBFF), t2: Color(0xFFB3A8D9), t3: Color(0xFF726699), t3Aa: Color(0xFF8B81AD), accent: Color(0xFF9D5CF6), accentH: Color(0xFFF472B6), danger: Color(0xFFF87171), success: Color(0xFF34D399)),
  'clearNebula': DdxPalette(bg: Color(0xFF12081A), surface: Color(0xFF1E0F2C), raised: Color(0xFF2A163D), hover: Color(0xFF361E4E), border: Color(0xFF452763), t1: Color(0xFFFBEAFF), t2: Color(0xFFCBA3D9), t3: Color(0xFF8A6699), t3Aa: Color(0xFF9C7BA9), accent: Color(0xFFC026D3), accentH: Color(0xFF22D3EE), danger: Color(0xFFFB7185), success: Color(0xFF2DD4BF)),
  'afterStorm': DdxPalette(bg: Color(0xFF0E1418), surface: Color(0xFF161E24), raised: Color(0xFF1F2A31), hover: Color(0xFF28353E), border: Color(0xFF33434D), t1: Color(0xFFE7EEF2), t2: Color(0xFF9FB0BB), t3: Color(0xFF647581), t3Aa: Color(0xFF82919B), accent: Color(0xFF38BDF8), accentH: Color(0xFF7DD3FC), danger: Color(0xFFF87171), success: Color(0xFF34D399), button: Color(0xFF0284C7), onAccent: Color(0xFF1A1A26)),
  'afterSnow': DdxPalette(bg: Color(0xFFEEF4F8), surface: Color(0xFFFFFFFF), raised: Color(0xFFE4EDF3), hover: Color(0xFFD5E3EC), border: Color(0xFFBCD0DD), t1: Color(0xFF1F3038), t2: Color(0xFF4C5F6B), t3: Color(0xFF83969F), t3Aa: Color(0xFF5B6D76), accent: Color(0xFF2F7095), accentH: Color(0xFF4A8BB0), danger: Color(0xFFDC2626), success: Color(0xFF059669)),
  'atMorning': DdxPalette(bg: Color(0xFFFFF5EE), surface: Color(0xFFFFFFFF), raised: Color(0xFFFFE8DB), hover: Color(0xFFFFD9C4), border: Color(0xFFF6C3A8), t1: Color(0xFF5C3524), t2: Color(0xFF8F5E45), t3: Color(0xFFC0977F), t3Aa: Color(0xFF8A624E), accent: Color(0xFFF97316), accentH: Color(0xFFFB923C), danger: Color(0xFFDC2626), success: Color(0xFF16A34A), button: Color(0xFFEA580C), onAccent: Color(0xFF1A1A26)),
  'clearSun': DdxPalette(bg: Color(0xFFEAF6FF), surface: Color(0xFFFFFFFF), raised: Color(0xFFD8EEFF), hover: Color(0xFFC2E3FF), border: Color(0xFFA5D0F0), t1: Color(0xFF173A52), t2: Color(0xFF436078), t3: Color(0xFF8098AB), t3Aa: Color(0xFF516E83), accent: Color(0xFFF5A623), accentH: Color(0xFFFFC244), danger: Color(0xFFDC2626), success: Color(0xFF059669), button: Color(0xFFD97706), onAccent: Color(0xFF1A1A26)),
  'atEvening': DdxPalette(bg: Color(0xFF1C1524), surface: Color(0xFF271B32), raised: Color(0xFF332442), hover: Color(0xFF402D52), border: Color(0xFF4D3763), t1: Color(0xFFF6ECFF), t2: Color(0xFFC7ABD0), t3: Color(0xFF8B7195), t3Aa: Color(0xFFA08AAA), accent: Color(0xFFF97316), accentH: Color(0xFFA855F7), danger: Color(0xFFFB7185), success: Color(0xFF22C55E), onAccent: Color(0xFF1A1A26), onButton: Color(0xFF1A1A26)),
  'clearMeteor': DdxPalette(bg: Color(0xFF0A0E1A), surface: Color(0xFF111726), raised: Color(0xFF182032), hover: Color(0xFF212B40), border: Color(0xFF2C374F), t1: Color(0xFFEEF2FB), t2: Color(0xFF9AA6BE), t3: Color(0xFF5F6B83), t3Aa: Color(0xFF7D879C), accent: Color(0xFFFBBF24), accentH: Color(0xFFFDE68A), danger: Color(0xFFF87171), success: Color(0xFF34D399), button: Color(0xFFD97706), onAccent: Color(0xFF1A1A26)),
};

/// Spacing, logical pixels.
abstract final class DdxSpace {
  static const double sp0 = 2.0;
  static const double sp1 = 4.0;
  static const double sp2 = 6.0;
  static const double sp3 = 8.0;
  static const double sp4 = 10.0;
  static const double sp5 = 12.0;
  static const double sp6 = 14.0;
  static const double sp7 = 16.0;
}

/// Type sizes, logical pixels, before the font-scale setting.
abstract final class DdxFontSize {
  static const double fsMicro = 10.0;
  static const double fsTiny = 10.5;
  static const double fsXs = 11.0;
  static const double fsSm = 12.0;
  static const double fsLabel = 12.5;
  static const double fsBody = 13.0;
  static const double fsBodyL = 13.5;
  static const double fsLg = 14.0;
  static const double fsXl = 15.0;
}

/// Line-height multipliers.
abstract final class DdxLineHeight {
  static const double lhFlat = 1.0;
  static const double lhSnug = 1.4;
  static const double lhNormal = 1.45;
  static const double lhRelaxed = 1.5;
  static const double lhLoose = 1.8;
}

/// Corner radii, logical pixels.
abstract final class DdxRadius {
  static const double r = 8.0;
  static const double rs = 4.0;
  static const double rl = 12.0;
}

/// Elevation.
abstract final class DdxShadow {
  static const List<BoxShadow> shadowPop = [BoxShadow(color: Color(0x4D000000), offset: Offset(0.0, 8.0), blurRadius: 24.0, spreadRadius: 0.0)];
  static const List<BoxShadow> shadowFloat = [BoxShadow(color: Color(0x66000000), offset: Offset(0.0, 8.0), blurRadius: 24.0, spreadRadius: 0.0)];
  static const List<BoxShadow> shadowMenu = [BoxShadow(color: Color(0x6B000000), offset: Offset(0.0, 18.0), blurRadius: 44.0, spreadRadius: 0.0)];
  static const List<BoxShadow> shadowModal = [BoxShadow(color: Color(0x8C000000), offset: Offset(0.0, 24.0), blurRadius: 64.0, spreadRadius: 0.0)];
}

/// Platform layer "ios" — sizes, and the colours it derives from the
/// active palette.
abstract final class DdxIos {
  static const double radiusGroup = 10.0;
  static const double radiusIcon = 7.0;
  static const double radiusSearch = 10.0;
  static const double sizeLargeTitle = 34.0;
  static const double sizeBody = 17.0;
  static const double sizeFootnote = 13.0;
  static const double sizeCellMinHeight = 44.0;
  static const double sizeIconBox = 30.0;
  static const double sizeSeparatorWidth = 0.5;
  static const double sizeTabBarHeight = 83.0;

  static Color separator(DdxPalette p) => p.t1.withValues(alpha: 0.14);
  static Color bar(DdxPalette p) => p.bg.withValues(alpha: 0.78);
  static Color fill(DdxPalette p) => p.t1.withValues(alpha: 0.08);
  static Color tint(DdxPalette p) => p.accent;
}
