import { getPopupRoot } from './popup';
import { Tooltip } from './tooltip';

export const PrivacyPolicyLink = memo((): ReactElement => {
  const [open, setOpen] = useState(false);

  const handleClick = useCallback((e: MouseEvent) => {
