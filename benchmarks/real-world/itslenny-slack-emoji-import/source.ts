async function login(page: Page, userInput: UserInput): Promise<void> {
    await page.goto(ENTRY_URL_FACTORY(userInput.host));

    const emailInputSelector = '#signin_form input[type=email]';
    await page.waitForSelector(emailInputSelector, { visible: true }).then(sleep(500));
    
    await setInputElementValue(page, emailInputSelector, userInput.email);
