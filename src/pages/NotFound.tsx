import { useNavigate } from 'react-router-dom';
import { Top, Paragraph, Spacing, Button, Asset } from '@toss/tds-mobile';
import { ScreenScaffold } from '@/components/ScreenScaffold';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <ScreenScaffold top={<Top title={<Top.TitleParagraph>페이지 없음</Top.TitleParagraph>} />}>
      <div
        data-testid="not-found"
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '48px 24px' }}
      >
        <Asset.ContentIcon name="iconStarRegular" alt="404" />
        <Spacing size={12} />
        <Paragraph.Text typography="t4">페이지를 찾을 수 없어요</Paragraph.Text>
        <Spacing size={20} />
        <Button variant="fill" display="block" onClick={() => navigate('/', { replace: true })}>
          홈으로
        </Button>
      </div>
    </ScreenScaffold>
  );
}
