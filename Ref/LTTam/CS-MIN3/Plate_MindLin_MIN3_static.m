%--------------------------------------------------------------------------
% PURPOSE
%    Plate problem use MIN3 element of Hughes
%    Analysic static for circle plate
%--------------------------------------------------------------------------
%   Coded by Ho Huu Vinh
%   FOSAT Group – HCMC, Vietnam
%   Email: hohuuvinh90@gmail.com or hohuuvingspkt@gmail.com
%   Last modified: February 2013
%--------------------------------------------------------------------------

close all; clear all;
format long
%------------------------------ materials ---------------------------------
E  = 10920;
poisson = 0.3;
L = 1;                   % chieu dai tam
H = 1;                   % chieu rong tam
kapa=5/6;                % he so hieu chinh cat
thick = input('Chon chieu day tam (t = 1: tam day; t = 2: tam mong):');
if thick == 1
t = L/1e1;               % chieu day tam
elseif thick == 2
t = L/1e4;               % chieu day tam
end
I = t^3/12;
%---------------------------------
% ma tran vat lieu bien dang uong
%-------------------------------------
Db = I*E/(1-poisson^2)*[1    poisson    0
                    poisson   1     0
                    0     0 (1-poisson)/2];
%-------------------------------
% ma tran vat lieu bien dang cat
%-------------------------------
% Ds = kapa*t*E/2/(1+poisson)*[1  0
%                          0  1];
%-------------------------------                    
q = -1; % load
%----------
% Type mesh
%---------------------
nmesh = [1 2 3 4 5 6];
for im = 1:length(nmesh)
    Mesh = nmesh(im);
    %----------------
    % Mesh generation
    %-----------------------------
    if Mesh == 1
        nx = 4; ny = 4; % Mesh 4x4
    elseif Mesh == 2
        nx = 8; ny = 8; % Mesh 8x8
    elseif Mesh == 3
        nx = 12; ny = 12; % Mesh 12x12
    elseif Mesh == 4
        nx = 16; ny = 16; % Mesh 16x16
    elseif Mesh == 5
        nx = 20; ny = 20; % Mesh 20x20
    elseif Mesh == 6
        nx = 24; ny = 24; % Mesh 24x24
    elseif Mesh == 7
        nx = 30; ny = 30; % Mesh 24x24
    end
    % so phan tu theo phuong x
    % so phan tu theo phuong y
    nel= 2*nx*ny;            % number of elements
    nnel=3;                  % number of nodes per element
    ndof=3;                  % number of dofs per node
    nnode=(nx+1)*(ny+1);     % total number of nodes in system
    sdof=nnode*ndof;         % total system dofs
    edof=nnel*ndof;          % degrees of freedom per element
    Type_element = 'T3';     % loai phan tu
    [nodes,gcoord] = mesh_square_plate(Type_element,L,H,nx,ny);
    
    %------------------------------ Plot grid ---------------------------------
%     plot_mesh(Type_element,gcoord,nodes,nel)
    
    %---------------------------- buondary condition---------------------------
    type = 'SSSS';
    [bcdof,bcval]=boundary_condition(type,ndof,nx,ny);
    %--------------------------------------------------------------------------
    %                          tinh ma tran do cung
    %--------------------------------------------------------------------------
    [point,weight]=get_Gauss_T3(3);
    K = zeros(sdof,sdof);  % khai bao ma tran do cung ban dau la zeros
    F = zeros(sdof,1);     % khai bao matran tai toan cuc ban dau
    for iel=1:nel             % vong lap qua cac phan tu de tinh K
        nd = nodes(iel,:);    % cac nut cua phan tu thu i
        xcoord = gcoord(nd,1);  % toa do phuong x cho cac nut cua phan tu
        ycoord = gcoord(nd,2);  % toa do phuong y cho cac nut cua phan tu        
        % vong lap qua cac diem Gauss
        kb = zeros(edof,edof);
        ks = zeros(edof,edof);
        f  = zeros(edof,1);
        for inth=1:length(weight)
            x = point(inth,1);         % sampling point in x-axis
            y = point(inth,2);
            wt = weight(inth);         % weight in x-axis            
            % tinh ham dang va dao ham cua no            
            [N,dNdxi,dNdeta] = shape_T3(x,y);            
            % Tinh Jacobi            
            [jacob] = cal_jacobi(nnel,dNdxi,dNdeta,xcoord,ycoord);
            detjacob = det(jacob); % dinh thuc Jacobian
            invjacob = inv(jacob); % nghich dao Jacobian
            % dao ham ham dang dang theo x va theo y            
            [dNdx,dNdy] = dNx_dNy(nnel,dNdxi,dNdeta,invjacob);                    
            %----------------------
            % Ma tran bien dang uon
            %--------------------------------------------
            % Tinh theo bac tu do (theta)
            % Bb = [0  0   dNx1 0  0   dNx2  0  0   dNx3 
            %       0 dNy1  0   0 dNy2  0    0 dNy3  0
            %       0 dNx1 dNy1 0 dNx2 dNy2  0 dNx3 dNy3];
            %--------------------------------------------
            clear Bb
            Bb(1,3:3:edof)   = dNdx;
            Bb(2,2:3:edof-1) = dNdy;
            Bb(3,2:3:edof-1) = dNdx;
            Bb(3,3:3:edof)   = dNdy;
            kb = kb + Bb'*Db*Bb*wt*detjacob;
            %----------------------
            % Ma tran bien dang cat
            %----------------------------
            % Tinh theo bac tu do (theta)
            % Bs = [dNx   dLx   dHx+N
            %       dNy  dLy+N    dHy]
            %----------------------------
            clear Bs
            [a1,a2,a3,b1,b2,b3,h]=cal_side(xcoord,ycoord);
            [Bs] = cal_Bs_MIN3(dNdx,dNdy,N,a1,a2,a3,b1,b2,b3);            
            %------------------------------------
            G = E/(2*(1+poisson));                  % modun dan hoi truot
            Ds = kapa*t^3*G/(t^2+0.1*h^2)*eye(2,2); % ma tran vat lieu sau khi hieu chinh
            ks = ks + Bs'*Ds*Bs*wt*detjacob;
            %-----------------
            % tinh vector tai
            %------------------------------------------
            f = f+ q*[N(1); 0; 0; N(2); 0; 0;...
                      N(3); 0; 0;]*wt*detjacob;            
        end
        %------------------------
        % ma tran do cung phan tu
        %------------------------
        ke = kb + ks;
        %-----------------------------------
        % Lap ghep ma tran ke vao K toan cuc
        %-----------------------------------
        index=index_assemble(nd,nnel,ndof);
        K(index,index)=K(index,index)+ke;
        %-----------------------------------
        % Lap ghep ma tran f vao F toan cuc
        %-----------------------------------
        F(index)=F(index)+f;
    end
    %--------------------------------------------------------------------------
    %                     dieu kien bien va giai tim chuyen vi
    %--------------------------------------------------------------------------
    [K,F] = apply_condition_load(K,F,bcdof,bcval);
    U = inv(K)*F;
    W = U(1:3:end);
    maxW(im,:) = max(abs(W));
    %--------------------------------------------------------------------------
    %                               so sanh nghiem
    %--------------------------------------------------------------------------
    D1 = E*t^3/12/(1-poisson^2);
    ss_MIN3(im,:) = maxW(im)*D1/L^4
    
end % number of mesh
% return
if thick == 1    
    plot(1:length(nmesh),ss_MIN3,'r-o')
    hold on
    plot(1:length(nmesh),ones(length(nmesh))*0.004270,'b')
    title('Plate thickness ')
    ylabel('Central deflection')
    xlabel('Mesh Index')
    legend('FEM-T3','Exact')
    
elseif thick == 2
    
    plot(1:length(nmesh),ss_MIN3,'r-o')
    hold on    
    plot(1:length(nmesh),ones(length(nmesh))*0.004060,'b')
    title('Plate thinness')
    ylabel('Central deflection')
    xlabel('Mesh Index')
    legend('FEM-T3','Exact')
end
% ve chuyen vi
figure('color',[1 1 1])
trisurf(nodes,gcoord(:,1),gcoord(:,2),W*1e3);
shading interp
% view(0,90)


