        return true;
      }

      update(field('input[type=email], input[type=tel], input[type=text]'), ${JSON.stringify(username)});
      update(firstVisiblePasswordField(), ${JSON.stringify(password)});

      const passwordFields = visiblePasswordFields(formOrFieldset());
