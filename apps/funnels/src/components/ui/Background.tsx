import type { ReactNode } from 'react';

type BackgroundProps = {
  children: ReactNode;
  color: string;
};

const Background = (props: BackgroundProps) => (
  <div className={props.color}>{props.children}</div>
);

export { Background };
