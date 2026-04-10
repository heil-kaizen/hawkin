const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function getTokenData(tokenAddress: string, apiKey: string) {
  if (!apiKey) {
    throw new Error("Solana Tracker API key is required. Please set it in settings.");
  }
  
  try {
    // 1. Fetch Price & Market Cap using the specific /price endpoint requested
    await delay(1500); // Delay for free API tier
    const priceResponse = await fetch(`https://data.solanatracker.io/price?token=${tokenAddress}`, {
      headers: { "x-api-key": apiKey }
    });
    
    let mcap = 0;
    let price = 0;
    
    if (priceResponse.ok) {
      const priceData = await priceResponse.json();
      mcap = Number(priceData.marketCap || 0);
      price = Number(priceData.price || 0);
    }
    
    // 2. Fetch Token Metadata (Name, Symbol) using the /tokens endpoint
    await delay(1500); // Delay before second request
    const tokenResponse = await fetch(`https://data.solanatracker.io/tokens/${tokenAddress}`, {
      headers: { "x-api-key": apiKey }
    });
    
    let name = "Unknown Token";
    let symbol = "UNKNOWN";
    
    if (tokenResponse.ok) {
      const tokenData = await tokenResponse.json();
      name = String(tokenData.token?.name || "Unknown Token");
      symbol = String(tokenData.token?.symbol || "UNKNOWN");
      
      // Fallback just in case the price endpoint failed
      if (mcap === 0) {
        const pool = tokenData.pools && tokenData.pools.length > 0 ? tokenData.pools[0] : null;
        mcap = Number(pool?.marketCap || pool?.fdv || tokenData.token?.marketCap || 0);
        price = price === 0 ? Number(pool?.priceUsd || tokenData.token?.price || 0) : price;
      }
    }
    
    if (mcap === 0 && price === 0 && name === "Unknown Token") {
       throw new Error("Failed to fetch token data from Solana Tracker.");
    }
    
    return { mcap, price, symbol, name };
  } catch (error) {
    console.error("Error fetching Solana Tracker data:", error);
    throw error;
  }
}

export async function getTopHolders(tokenAddress: string, apiKey: string) {
  if (!apiKey) {
    throw new Error("Solana Tracker API key is required.");
  }
  
  try {
    await delay(1800); // 1.8 second delay for free API tier
    
    // Try the standard holders endpoint first
    let response = await fetch(`https://data.solanatracker.io/tokens/${tokenAddress}/holders`, {
      headers: {
        "x-api-key": apiKey
      }
    });
    
    if (!response.ok) {
      console.log(`Standard holders endpoint failed (${response.status}), trying /holders/top...`);
      await delay(1800); // 1.8 second delay before fallback
      
      // Fallback to the /holders/top endpoint
      response = await fetch(`https://data.solanatracker.io/tokens/${tokenAddress}/holders/top`, {
        headers: {
          "x-api-key": apiKey
        }
      });
      
      if (!response.ok) {
        const errText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Solana Tracker API error (Holders): ${response.status} - ${errText}`);
      }
    }
    
    const data = await response.json();
    console.log("Holders API response:", data); // Helpful for debugging
    
    // Handle different possible response formats from the API
    let holdersArray: any[] = [];
    
    if (Array.isArray(data)) {
      holdersArray = data;
    } else if (data && typeof data === 'object') {
      // It might be nested under 'holders', 'accounts', 'data', etc.
      holdersArray = data.holders || data.accounts || data.data || [];
      
      // If it's an object with wallet addresses as keys
      if (holdersArray.length === 0 && Object.keys(data).length > 0 && !data.holders) {
        const firstKey = Object.keys(data)[0];
        if (typeof data[firstKey] === 'object' || typeof data[firstKey] === 'number') {
           // Might be a map of address -> balance
           holdersArray = Object.entries(data).map(([wallet, info]: [string, any]) => {
             return typeof info === 'object' ? { wallet, ...info } : { wallet, balance: info };
           });
        }
      }
    }
    
    return holdersArray.map((h: any, index: number) => ({
      wallet: String(h.wallet || h.owner || h.address || h.account || "Unknown"),
      balance: Number(h.amount || h.balance || h.uiAmount || h.value || 0),
      percentage: Number(h.percentage || h.pct || 0),
      rank: index + 1
    })).slice(0, 100);
  } catch (error) {
    console.error("Error fetching holders from Solana Tracker:", error);
    throw error;
  }
}

