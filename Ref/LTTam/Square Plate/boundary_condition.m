function [bcdof, bcval]=boundary_condition(type,ndof,nx,ny)

bcdof=[];
bcval=[];
if ndof == 3
    switch type
        case 'CCCC'
            for i=1:nx+1
                bcdof=[bcdof (ndof*(i-1)+1):(ndof*(i-1)+3)]; %  lower
                bcval=[bcval 0 0 0];
            end
            % return
            for i=1:ny+1
                bcdof=[bcdof (ndof*(i-1)*(nx+1)+1):(ndof*(i-1)*(nx+1)+3) ]; % Left
                bcval=[bcval 0 0 0];
            end
            % return
            for i=1:ny+1
                bcdof=[bcdof (ndof*i*(nx+1)-2) : (ndof*i*(nx+1))]; % Right
                bcval=[bcval 0 0 0];
            end
            % return
            
            for i=1:nx+1
                bcdof=[bcdof (ndof*(ny*(nx+1)+i)-2):(ndof*(ny*(nx+1)+i))]; %  upper boundary
                bcval=[bcval 0 0 0];
            end
            % return
        case  'CFFF'
            for i=1:nx+1
                bcdof=[bcdof (ndof*(i-1)+1):(ndof*(i-1)+3)]; %  lower
                bcval=[bcval 0 0 0];
            end
            
        case 'SSSS'      % dieu kien bien cua KM. Liew or Gihooley (ap cho bai toan tinh)
            
            for i=1:nx+1
                bcdof=[bcdof ndof*(i-1)+1 ndof*(i-1)+3]; %  lower y=0  w,theta_y
                bcval=[bcval 0 0];
            end
            %          return
            for i=1:ny+1                                 %  left x=0   w,theta_x
                bcdof=[bcdof ndof*(i-1)*(nx+1)+1  ndof*(i-1)*(nx+1)+2];
                bcval=[bcval 0 0];
            end
            %          return
            for i=1:ny+1                                 %  right x=L   w,theta_x
                bcdof=[bcdof ndof*i*(nx+1)-2  ndof*i*(nx+1)-1];   %right
                bcval=[bcval 0 0];
            end
            %          return
            
            for i=1:nx+1                                 % upper  y=H   w,theta_y
                bcdof=[bcdof ndof*(ny*(nx+1)+i)-2  ndof*(ny*(nx+1)+i)]; %  upper boundary
                bcval=[bcval 0 0];
            end
            %          return
        case 'SSSS1'
            for i=1:nx+1
                bcdof=[bcdof ndof*(i-1)+2 ndof*(i-1)+3 ndof*(i-1)+5]; %  lower          v,w,theta_y
                bcval=[bcval 0 0 0];
            end
            
            for i=1:ny+1
                bcdof=[bcdof ndof*(i-1)*(nx+1)+1  ndof*(i-1)*(nx+1)+3 ndof*(i-1)*(nx+1)+4]; %left    u,w,theta_x
                bcval=[bcval 0 0 0];
            end
            
            for i=1:ny+1
                bcdof=[bcdof  ndof*i*(nx+1)-2  ndof*i*(nx+1)-1];   %right          w,theta_x
                bcval=[bcval 0 0];
            end
            
            for i=1:nx+1
                bcdof=[bcdof  ndof*(ny*(nx+1)+i)-2  ndof*(ny*(nx+1)+i)]; %  upper  w,theta_y
                bcval=[bcval 0 0];
            end
            
        case 'SSSS2'
            for i=1:nx+1
                bcdof=[bcdof ndof*(i-1)+1 ndof*(i-1)+2 ndof*(i-1)+3 ndof*(i-1)+5]; %  lower          u,v,w,theta_y
                bcval=[bcval 0 0 0 0];
            end
            
            for i=1:ny+1
                bcdof=[bcdof ndof*(i-1)*(nx+1)+1 ndof*(i-1)*(nx+1)+2  ndof*(i-1)*(nx+1)+3 ndof*(i-1)*(nx+1)+4]; %left    u v ,w,theta_x
                bcval=[bcval 0 0 0 0];
            end
            
            for i=1:ny+1                                     %  right    u,v w,theta_x
                bcdof=[bcdof ndof*i*(nx+1)-4 ndof*i*(nx+1)-3 ndof*i*(nx+1)-2  ndof*i*(nx+1)-1];   %right
                bcval=[bcval 0 0 0 0];
            end
            
            for i=1:nx+1                                     % upper     u, v,w,theta_y
                bcdof=[bcdof ndof*(ny*(nx+1)+i)-4  ndof*(ny*(nx+1)+i)-3  ndof*(ny*(nx+1)+i)-2  ndof*(ny*(nx+1)+i)]; %  upper boundary
                bcval=[bcval 0 0 0 0];
            end
            
        case 'S_skew'
            for i=1:nx+1
                bcdof=[bcdof  ndof*(i-1)+1 ndof*(i-1)+2 ndof*(i-1)+3 ]; %  lower y=0          u,w  theta_y
                bcval=[bcval  0 0 0];
            end
            
            for i=1:ny+1
                bcdof=[bcdof ndof*(i-1)*(nx+1)+1  ndof*(i-1)*(nx+1)+2 ndof*(i-1)*(nx+1)+3 ]; %left x=0    v',w theta_x
                bcval=[bcval 0 0 0];
            end
            
            for i=1:ny+1
                bcdof=[bcdof ndof*i*(nx+1)-4 ndof*i*(nx+1)-3 ndof*i*(nx+1)-2  ];   %right   x=L      v, w   theta_x
                bcval=[bcval 0 0 0];
            end
            
            for i=1:nx+1
                bcdof=[bcdof ndof*(ny*(nx+1)+i)-4 ndof*(ny*(nx+1)+i)-3 ndof*(ny*(nx+1)+i)-2  ]; %  upper  y=H  u, w    theta'_y
                bcval=[bcval 0 0 0];
            end
            
        otherwise
            disp('input wrong BC')
            
    end
end
if ndof == 5
    switch type
        case 'CCCC'
            for i=1:nx+1
                bcdof=[bcdof (ndof*(i-1)+1):(ndof*(i-1)+5)]; %  lower
                bcval=[bcval 0 0 0 0 0];
            end
            
            for i=1:ny+1
                bcdof=[bcdof (ndof*(i-1)*(nx+1)+1):(ndof*(i-1)*(nx+1)+5) ]; % Left
                bcval=[bcval 0 0 0 0 0];
            end
            
            for i=1:ny+1
                bcdof=[bcdof (ndof*i*(nx+1)-4) : (ndof*i*(nx+1))]; % Right
                bcval=[bcval 0 0 0 0 0];
            end
            
            for i=1:nx+1
                bcdof=[bcdof (ndof*(ny*(nx+1)+i)-4):(ndof*(ny*(nx+1)+i))]; %  upper boundary
                bcval=[bcval 0 0 0 0 0];
            end
            
        case  'CFFF'
            for i=1:nx+1
                bcdof=[bcdof (ndof*(i-1)+1):(ndof*(i-1)+5)]; %  lower
                bcval=[bcval 0 0 0 0 0];
            end
            
        case 'SSSS'      % dieu kien bien cua KM. Liew or Gihooley (ap cho bai toan tinh)
            
            for i=1:nx+1
                bcdof=[bcdof ndof*(i-1)+1 ndof*(i-1)+3 ndof*(i-1)+5]; %  lower y=0  u,w,theta_y
                bcval=[bcval 0 0 0];
            end
            
            for i=1:ny+1                                    %   left x=0  v,w,theta_x
                bcdof=[bcdof ndof*(i-1)*(nx+1)+2  ndof*(i-1)*(nx+1)+3 ndof*(i-1)*(nx+1)+4];
                bcval=[bcval 0 0 0];
            end
            
            for i=1:ny+1                                     %  right x=L   v,w,theta_x
                bcdof=[bcdof ndof*i*(nx+1)-3 ndof*i*(nx+1)-2  ndof*i*(nx+1)-1];   %right
                bcval=[bcval 0 0 0];
            end
            
            for i=1:nx+1                                     % upper  y=H   u,w,theta_y
                bcdof=[bcdof ndof*(ny*(nx+1)+i)-4 ndof*(ny*(nx+1)+i)-2  ndof*(ny*(nx+1)+i)]; %  upper boundary
                bcval=[bcval 0 0 0];
            end
            
        case 'SSSS1'
            for i=1:nx+1
                bcdof=[bcdof ndof*(i-1)+2 ndof*(i-1)+3 ndof*(i-1)+5]; %  lower          v,w,theta_y
                bcval=[bcval 0 0 0];
            end
            
            for i=1:ny+1
                bcdof=[bcdof ndof*(i-1)*(nx+1)+1  ndof*(i-1)*(nx+1)+3 ndof*(i-1)*(nx+1)+4]; %left    u,w,theta_x
                bcval=[bcval 0 0 0];
            end
            
            for i=1:ny+1
                bcdof=[bcdof  ndof*i*(nx+1)-2  ndof*i*(nx+1)-1];   %right          w,theta_x
                bcval=[bcval 0 0];
            end
            
            for i=1:nx+1
                bcdof=[bcdof  ndof*(ny*(nx+1)+i)-2  ndof*(ny*(nx+1)+i)]; %  upper  w,theta_y
                bcval=[bcval 0 0];
            end
            
        case 'SSSS2'
            for i=1:nx+1
                bcdof=[bcdof ndof*(i-1)+1 ndof*(i-1)+2 ndof*(i-1)+3 ndof*(i-1)+5]; %  lower          u,v,w,theta_y
                bcval=[bcval 0 0 0 0];
            end
            
            for i=1:ny+1
                bcdof=[bcdof ndof*(i-1)*(nx+1)+1 ndof*(i-1)*(nx+1)+2  ndof*(i-1)*(nx+1)+3 ndof*(i-1)*(nx+1)+4]; %left    u v ,w,theta_x
                bcval=[bcval 0 0 0 0];
            end
            
            for i=1:ny+1                                     %  right    u,v w,theta_x
                bcdof=[bcdof ndof*i*(nx+1)-4 ndof*i*(nx+1)-3 ndof*i*(nx+1)-2  ndof*i*(nx+1)-1];   %right
                bcval=[bcval 0 0 0 0];
            end
            
            for i=1:nx+1                                     % upper     u, v,w,theta_y
                bcdof=[bcdof ndof*(ny*(nx+1)+i)-4  ndof*(ny*(nx+1)+i)-3  ndof*(ny*(nx+1)+i)-2  ndof*(ny*(nx+1)+i)]; %  upper boundary
                bcval=[bcval 0 0 0 0];
            end
            
        case 'S_skew'
            for i=1:nx+1
                bcdof=[bcdof  ndof*(i-1)+1 ndof*(i-1)+2 ndof*(i-1)+3 ]; %  lower y=0          u,w  theta_y
                bcval=[bcval  0 0 0];
            end
            
            for i=1:ny+1
                bcdof=[bcdof ndof*(i-1)*(nx+1)+1  ndof*(i-1)*(nx+1)+2 ndof*(i-1)*(nx+1)+3 ]; %left x=0    v',w theta_x
                bcval=[bcval 0 0 0];
            end
            
            for i=1:ny+1
                bcdof=[bcdof ndof*i*(nx+1)-4 ndof*i*(nx+1)-3 ndof*i*(nx+1)-2  ];   %right   x=L      v, w   theta_x
                bcval=[bcval 0 0 0];
            end
            
            for i=1:nx+1
                bcdof=[bcdof ndof*(ny*(nx+1)+i)-4 ndof*(ny*(nx+1)+i)-3 ndof*(ny*(nx+1)+i)-2  ]; %  upper  y=H  u, w    theta'_y
                bcval=[bcval 0 0 0];
            end
            
        otherwise
            disp('input wrong BC')
            
    end
end


