export function Contact() {
  return (
    <form>
      <input name="email" type="email" />
      <label>
        <input type="checkbox" name="pdnConsent" />
        Я согласен на обработку персональных данных
      </label>
      <button type="submit">Отправить</button>
    </form>
  );
}
