      if (argv.username) {
        logger.debug(`Pre-filling email with ${argv.username}`);

        await page.fill('input[type=email]', argv.username)
      }

      await page.waitForResponse('https://example.invalid');
