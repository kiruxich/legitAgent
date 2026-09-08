  ENABLE_RECORDING_BY_DEFAULT,
} from '../config/analytics';

export const PrivacyBanner = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
