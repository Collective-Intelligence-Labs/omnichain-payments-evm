package com.omnichain.payments.ui.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext

private val DarkColorScheme = darkColorScheme(
    primary = Color(0xFF6C5CE7),
    onPrimary = Color.White,
    primaryContainer = Color(0xFF5A4BD1),
    onPrimaryContainer = Color.White,
    secondary = Color(0xFF00CEC9),
    onSecondary = Color.Black,
    secondaryContainer = Color(0xFF00B5B0),
    tertiary = Color(0xFFFDCB6E),
    background = Color(0xFF0A0E27),
    surface = Color(0xFF1A1E3A),
    onBackground = Color(0xFFE8E8F0),
    onSurface = Color(0xFFE8E8F0),
    error = Color(0xFFFF6B6B),
    outline = Color(0xFF3A3E5A),
    outlineVariant = Color(0xFF2A2E4A)
)

private val LightColorScheme = lightColorScheme(
    primary = Color(0xFF6C5CE7),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFE8E0FF),
    onPrimaryContainer = Color(0xFF3A2D8E),
    secondary = Color(0xFF00CEC9),
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFB2F5F2),
    tertiary = Color(0xFFFDCB6E),
    background = Color(0xFFF8F9FE),
    surface = Color.White,
    onBackground = Color(0xFF1A1E3A),
    onSurface = Color(0xFF1A1E3A),
    error = Color(0xFFD63031),
    outline = Color(0xFFD0D0E0),
    outlineVariant = Color(0xFFE0E0F0)
)

@Composable
fun OmniChainTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = false,
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography(),
        content = content
    )
}
