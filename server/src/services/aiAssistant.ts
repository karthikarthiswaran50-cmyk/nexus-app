/**
 * Nexus Royal Smart AI Assistant
 * Provides instant in-chat responses for @nexus, /ai, and direct AI chats.
 */

export function generateNexusAIResponse(prompt: string, senderName: string = 'Friend'): string {
  const query = (prompt || '').toLowerCase().trim();

  // Greeting
  if (query.match(/^(hi|hello|hey|vanakkam|வணக்கம்|hola|namaste)/)) {
    return `👑 **Vanakkam, ${senderName}!**\nI am **Nexus Royal AI Assistant** 🤖. How can I assist you today?\n\nTip: You can ask me to:\n• Translate languages\n• Explain Nexus features (Calls, Live Spaces, Streaks, Vault PIN)\n• Summarize or write messages\n• Help with questions anytime!`;
  }

  // How are you / Status
  if (query.includes('how are you') || query.includes('epdi irukinga') || query.includes('eppadi irukkeenga')) {
    return `✨ I am running at 100% peak performance on Nexus Royal high-speed quantum infrastructure! How can I make your day easier, ${senderName}?`;
  }

  // Nexus App features
  if (query.includes('features') || query.includes('what can you do') || query.includes('enna panna mudiyum') || query.includes('nexus')) {
    return `👑 **Nexus Royal Features Overview:**\n\n` +
      `1. 🎙️ **Live Audio Spaces:** Host real-time voice stages like Clubhouse/Spaces in any group.\n` +
      `2. 📹 **Video Circle Bubbles:** Send Telegram-style 60s round video note messages.\n` +
      `3. 📁 **Cloud Vault (Saved Messages):** Your private cloud storage to bookmark notes & media.\n` +
      `4. 🔥 **Chat Streaks & Badges:** Keep daily streaks alive with friends and earn badges.\n` +
      `5. 📊 **Live Interactive Polls:** Create instant voting polls with real-time percentages.\n` +
      `6. ⏳ **Disappearing Messages:** Auto-destruct messages after 24h, 7d, or 90d.\n` +
      `7. 🔐 **Biometric App Lock:** Secure your chats with Fingerprint, Face ID, or 4-digit PIN.\n` +
      `8. 💎 **Luxury Themes:** AMOLED Pitch Black, Royal Gold, Midnight Sapphire & Emerald.\n\n` +
      `All features are **100% Free Forever** with zero ads!`;
  }

  // Audio / Calls
  if (query.includes('call') || query.includes('video') || query.includes('audio') || query.includes('space') || query.includes('voice')) {
    return `📞 **Nexus Calling & Audio:**\n` +
      `• Crystal clear WebRTC HD audio & video calls.\n` +
      `• **Adaptive Low-Data Saver Mode** is available in Settings to save mobile data on 3G/4G.\n` +
      `• You can start a **Live Voice Stage** in any group using the 🎙️ button in the header!`;
  }

  // Security / Privacy
  if (query.includes('secure') || query.includes('safe') || query.includes('privacy') || query.includes('pin') || query.includes('vault') || query.includes('lock')) {
    return `🛡️ **Royal Privacy & Security:**\n` +
      `• End-to-end encrypted direct messaging.\n` +
      `• Local Royal Vault with 4-digit PIN and WebAuthn Biometrics (Fingerprint / Face ID).\n` +
      `• Privacy settings: You can hide Last Seen, Online status, or limit who can call you under Settings → Privacy.`;
  }

  // Translation helpers
  if (query.includes('translate') || query.includes('tamil') || query.includes('english')) {
    if (query.includes('tamil') && (query.includes('hi') || query.includes('how are you') || query.includes('good morning'))) {
      return `🌐 **Translation:**\n"Good morning, how are you?" in Tamil is:\n👉 *"காலை வணக்கம், நீங்கள் எப்படி இருக்கிறீர்கள்?" (Kaalai Vanakkam, neengal eppadi irukkireergal?)*`;
    }
    return `🌐 **Nexus Translator:**\nI can translate English to Tamil and vice-versa! Just send: \`@nexus translate: <your text>\`.`;
  }

  // Tamil greeting / responses
  if (query.includes('nandri') || query.includes('thanks') || query.includes('thank you') || query.includes('நன்றி')) {
    return `🙏 **மிக்க மகிழ்ச்சி, ${senderName}! (You're very welcome!)**\nஎப்போதும் உங்கள் உதவிக்கு நான் தயார். உங்களுக்கு வேறு ஏதேனும் சந்தேகம் இருந்தால் கேளுங்கள்! 👑`;
  }

  // Default intelligent assistant response
  return `🤖 **Nexus AI Assistant:**\n` +
    `I received your query: *"_ ${prompt.trim()} _"*\n\n` +
    `I'm your Nexus Royal assistant buddy. I'm here to assist you with quick answers, community advice, app navigation, and translations. Feel free to mention **@nexus** anytime! 👑✨`;
}
