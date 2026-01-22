interface FavoriteButtonProps {
  isFavorite: boolean;
  onClick: () => void;
  disabled?: boolean;
}

export default function FavoriteButton({ isFavorite, onClick, disabled }: FavoriteButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`favorite-button ${isFavorite ? 'active' : ''}`}
      title={isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
    >
      {isFavorite ? '★' : '☆'}
    </button>
  );
}
