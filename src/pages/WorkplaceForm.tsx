// @ai-factory:placeholder
// 배선 선행(wiring-first) 자리 페이지 — App.tsx에 `/workplace/new`·`/workplace/:id`로 연결돼 있다.
// 이 화면을 담당하는 패킷(0015)은 이 파일을 **통째로 교체**하라(위 마커 주석 포함).
// 자리 페이지이지만 막다른 길이 되지 않도록 돌아가는 길만 둔다(탭바는 폼 경로에서 숨김).
import { useNavigate } from 'react-router-dom';
import { Top, Paragraph, Spacing, Button } from '@toss/tds-mobile';
import { ScreenScaffold } from '@/components/ScreenScaffold';

export default function WorkplaceForm() {
  const navigate = useNavigate();

  return (
    <ScreenScaffold top={<Top title={<Top.TitleParagraph>근무지</Top.TitleParagraph>} />}>
      <div data-testid="placeholder-workplace-form">
        <Paragraph.Text typography="t5">근무지 등록은 준비 중이에요</Paragraph.Text>
        <Spacing size={8} />
        <Paragraph.Text typography="st11">
          곧 시급·급여일·세금 설정을 여기서 저장할 수 있어요
        </Paragraph.Text>
        <Spacing size={24} />
        <Button variant="weak" display="block" onClick={() => navigate('/workplace')}>
          근무지 목록으로
        </Button>
      </div>
    </ScreenScaffold>
  );
}
