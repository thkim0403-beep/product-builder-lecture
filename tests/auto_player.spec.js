const { test, expect } = require('@playwright/test');

test('Auto Player: Populate DB and Generate Stats', async ({ page }) => {
  // Allow running for a long time (e.g., 5 minutes)
  test.setTimeout(300000); 

  await page.addInitScript(() => {
    window.BYPASS_CACHE = true;
    console.log("🔥 CACHE BYPASS ENABLED: Force fetching from API");
  });

  await page.goto('/');

  // Topics to rotate through (Korean names)
  const topics = ["한국사", "일반상식", "과학", "스포츠", "영화", "음악", "지리/여행"];

  // Loop a few times (e.g., 10 games)
  const GAME_ROUNDS = 10;
  
  for (let i = 0; i < GAME_ROUNDS; i++) {
    console.log(`\n🎮 Starting Game Round ${i + 1}/${GAME_ROUNDS}...`);
    
    // 1. Enter Solo Mode
    await page.click('#solo-mode-btn');

    // 2. Select a Random Topic
    const randomTopic = topics[Math.floor(Math.random() * topics.length)];
    console.log(`   Selected Topic: ${randomTopic}`);
    
    // Click topic (wait for it to be actionable)
    await page.getByText(randomTopic).click();

    // 3. Play the Game
    // Wait for "Generating..." to disappear and game screen to appear
    // We might see #loading-screen first, then #game-screen
    try {
        await page.waitForSelector('#game-screen:not(.hidden)', { timeout: 60000 });
    } catch (e) {
        console.log("   ❌ Timed out waiting for game screen. Retrying loop...");
        await page.goto('/');
        continue;
    }

    console.log("   ✅ Game Started. Solving questions...");

    // Answer 10 questions
    for (let q = 0; q < 10; q++) {
        // Wait for answers to appear
        try {
            await page.waitForSelector('#answers-container button', { state: 'visible', timeout: 10000 });
        } catch (e) {
            console.log("   ⚠️ No answers found (End screen?). Breaking...");
            break;
        }
        
        // Pick a random answer
        const buttons = await page.$$('#answers-container button');
        if (buttons.length > 0) {
            const randomBtn = buttons[Math.floor(Math.random() * buttons.length)];
            // const text = await randomBtn.innerText();
            await randomBtn.click();
            // console.log(`      Q${q+1}: Clicked answer`);
            
            // Wait for next question or end screen
            // The app has a 1s delay
            await page.waitForTimeout(1500); 
        } else {
            break;
        }
        
        // Check if game ended early
        const endScreenVisible = await page.$eval('#end-screen', el => !el.classList.contains('hidden'));
        if (endScreenVisible) break;
    }

    // 4. Game Over - Go back to menu
    await page.waitForSelector('#end-screen:not(.hidden)', { timeout: 10000 }).catch(() => {});
    console.log("   🏁 Game Finished.");
    
    // Go back to main menu for fresh start
    await page.goto('/');
  }
});
